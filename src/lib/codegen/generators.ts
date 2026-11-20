import { buildIR, type CodegenIR } from './ir';
import { dq, jsStr, pyStr, shQuote } from './escape';
import type { RequestModel } from '../../types';

export type LanguageId =
  | 'curl'
  | 'python'
  | 'javascript'
  | 'node'
  | 'go'
  | 'php'
  | 'ruby'
  | 'java'
  | 'csharp'
  | 'wget'
  | 'httpie'
  | 'powershell'
  | 'rust'
  | 'swift'
  | 'kotlin'
  | 'dart'
  | 'raw'
  | 'har';

export interface LanguageInfo {
  id: LanguageId;
  label: string;
  group: 'Shell' | 'Scripting' | 'Compiled' | 'Mobile' | 'Data';
  extension: string;
  /** Text shown when the generator cannot express the request. */
  note?: string;
}

export interface Generator {
  info: LanguageInfo;
  generate(ir: CodegenIR): string;
}

const ML_BODY_WARNING = (ir: CodegenIR) =>
  ir.body.kind === 'multipart' ? '# Multipart bodies are shown as text; set the file paths before sending.\n' : '';

/* ---------------- Shell family ---------------- */

const curlGen: Generator = {
  info: { id: 'curl', label: 'cURL', group: 'Shell', extension: 'sh' },
  generate(ir) {
    const lines: string[] = [`curl -X ${ir.method} ${shQuote(ir.url)}`];
    for (const [k, v] of ir.headers) lines.push(`  -H ${shQuote(`${k}: ${v}`)}`);
    if (ir.body.kind === 'text') lines.push(`  --data-raw ${shQuote(ir.body.text)}`);
    if (ir.body.kind === 'form') {
      const data = ir.body.fields
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
      lines.push(`  --data ${shQuote(data)}`);
    }
    if (ir.body.kind === 'multipart') {
      for (const p of ir.body.parts) {
        const v = p.fileName !== undefined ? `${p.name}=@${p.fileName}` : `${p.name}=${p.value}`;
        lines.push(`  -F ${shQuote(v)}`);
      }
    }
    return lines.join(' \\\n');
  },
};

const wgetGen: Generator = {
  info: { id: 'wget', label: 'Wget', group: 'Shell', extension: 'sh' },
  generate(ir) {
    const lines: string[] = [`wget --method=${ir.method} \\`];
    for (const [k, v] of ir.headers) lines.push(`  --header=${shQuote(`${k}: ${v}`)} \\`);
    if (ir.body.kind === 'text') lines.push(`  --body-data=${shQuote(ir.body.text)} \\`);
    if (ir.body.kind === 'form') {
      const data = ir.body.fields
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join('&');
      lines.push(`  --body-data=${shQuote(data)} \\`);
    }
    lines.push(`  -O - ${shQuote(ir.url)}`);
    return lines.join('\n');
  },
};

const httpieGen: Generator = {
  info: { id: 'httpie', label: 'HTTPie', group: 'Shell', extension: 'sh' },
  generate(ir) {
    const parts = ['http', ir.method === 'GET' ? '' : ir.method, shQuote(ir.url)].filter(Boolean);
    for (const [k, v] of ir.headers) parts.push(shQuote(`${k}:${v}`));
    if (ir.body.kind === 'text') parts.push('--raw', shQuote(ir.body.text));
    if (ir.body.kind === 'form') {
      for (const [k, v] of ir.body.fields) parts.push(shQuote(`${k}=${v}`));
      parts.push('--form');
    }
    if (ir.body.kind === 'multipart') {
      for (const p of ir.body.parts) {
        parts.push(shQuote(p.fileName !== undefined ? `${p.name}@${p.fileName}` : `${p.name}=${p.value}`));
      }
      parts.push('--multipart');
    }
    return parts.join(' ');
  },
};

const powershellGen: Generator = {
  info: { id: 'powershell', label: 'PowerShell', group: 'Shell', extension: 'ps1' },
  generate(ir) {
    const psq = (s: string) => `'${s.replace(/'/g, "''")}'`;
    const lines = ['$headers = @{}'];
    for (const [k, v] of ir.headers) lines.push(`$headers[${psq(k)}] = ${psq(v)}`);
    let call = `Invoke-RestMethod -Uri ${psq(ir.url)} -Method ${ir.method} -Headers $headers`;
    if (ir.body.kind === 'text') call += ` -Body ${psq(ir.body.text)}`;
    lines.push(call);
    return lines.join('\n');
  },
};

/* ---------------- Scripting ---------------- */

function pyHeadersLiteral(ir: CodegenIR): string {
  return `{\n${ir.headers.map(([k, v]) => `    ${pyStr(k)}: ${pyStr(v)},`).join('\n')}\n}`;
}

const pythonGen: Generator = {
  info: { id: 'python', label: 'Python (requests)', group: 'Scripting', extension: 'py' },
  generate(ir) {
    const lines = ['import requests', '', `url = ${pyStr(ir.url)}`];
    if (ir.headers.length) lines.push(`headers = ${pyHeadersLiteral(ir)}`);
    const args = [`url`, ir.headers.length ? 'headers=headers' : ''];
    if (ir.body.kind === 'text') args.push(`data=${pyStr(ir.body.text)}`);
    if (ir.body.kind === 'form') {
      const pairs = ir.body.fields.map(([k, v]) => `    (${pyStr(k)}, ${pyStr(v)}),`).join('\n');
      lines.push(`data = [\n${pairs}\n]`);
      args.push('data=data');
    }
    if (ir.body.kind === 'multipart') {
      lines.push(ML_BODY_WARNING(ir).trim());
      const files: string[] = [];
      const fields: string[] = [];
      for (const p of ir.body.parts) {
        if (p.fileName !== undefined) files.push(`    ${pyStr(p.name)}: (${pyStr(p.fileName)}, open(${pyStr(p.fileName)}, "rb")),`);
        else fields.push(`    ${pyStr(p.name)}: (None, ${pyStr(p.value)}),`);
      }
      lines.push(`files = {\n${[...files, ...fields].join('\n')}\n}`);
      args.push('files=files');
    }
    lines.push(
      '',
      `response = requests.request(${pyStr(ir.method)}, ${args.filter(Boolean).join(', ')}, timeout=30)`,
      'print(response.status_code)',
      'print(response.text)',
    );
    return lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
  },
};

const jsFetchGen: Generator = {
  info: { id: 'javascript', label: 'JavaScript (fetch)', group: 'Scripting', extension: 'js' },
  generate(ir) {
    const opts: string[] = [`  method: ${jsStr(ir.method)},`];
    if (ir.headers.length) {
      opts.push(`  headers: {\n${ir.headers.map(([k, v]) => `    ${jsStr(k)}: ${jsStr(v)},`).join('\n')}\n  },`);
    }
    if (ir.body.kind === 'text') opts.push(`  body: ${jsStr(ir.body.text)},`);
    if (ir.body.kind === 'form') {
      const pairs = ir.body.fields.map(([k, v]) => `    [${jsStr(k)}, ${jsStr(v)}],`).join('\n');
      opts.push(`  body: new URLSearchParams([\n${pairs}\n  ]),`);
    }
    if (ir.body.kind === 'multipart') {
      const lines = ['const form = new FormData();'];
      for (const p of ir.body.parts) {
        lines.push(
          p.fileName !== undefined
            ? `// Select the file for ${jsStr(p.fileName)} in a file input and append it here.\nform.append(${jsStr(p.name)}, fileInput.files[0]);`
            : `form.append(${jsStr(p.name)}, ${jsStr(p.value)});`,
        );
      }
      opts.push('  body: form,');
      return `${lines.join('\n')}\n\n${fetchCall(ir.url, opts)}`;
    }
    return fetchCall(ir.url, opts);
  },
};

function fetchCall(url: string, opts: string[]): string {
  return [`const response = await fetch(${jsStr(url)}, {`, ...opts, '});', '', 'const text = await response.text();', 'console.log(response.status, text);'].join('\n');
}

const nodeGen: Generator = {
  info: { id: 'node', label: 'Node.js (fetch)', group: 'Scripting', extension: 'mjs' },
  generate(ir) {
    const body = jsFetchGen.generate(ir);
    return `// Node.js 18+ provides fetch globally.\n${body}`;
  },
};

const rubyGen: Generator = {
  info: { id: 'ruby', label: 'Ruby (Net::HTTP)', group: 'Scripting', extension: 'rb' },
  generate(ir) {
    const lines = [
      "require 'net/http'",
      "require 'uri'",
      '',
      `uri = URI(${dq(ir.url)})`,
      `req = Net::HTTP::${ir.method[0]}${ir.method.slice(1).toLowerCase()}.new(uri)`,
    ];
    for (const [k, v] of ir.headers) lines.push(`req[${dq(k)}] = ${dq(v)}`);
    if (ir.body.kind === 'text') lines.push(`req.body = ${dq(ir.body.text)}`);
    lines.push(
      '',
      'res = Net::HTTP.start(uri.host, uri.port, use_ssl: uri.scheme == "https") do |http|',
      '  http.request(req)',
      'end',
      'puts res.code',
      'puts res.body',
    );
    return lines.join('\n');
  },
};

const phpGen: Generator = {
  info: { id: 'php', label: 'PHP (cURL)', group: 'Scripting', extension: 'php' },
  generate(ir) {
    const lines = ['<?php', '$ch = curl_init();', `curl_setopt($ch, CURLOPT_URL, ${dq(ir.url)});`];
    lines.push(`curl_setopt($ch, CURLOPT_CUSTOMREQUEST, ${dq(ir.method)});`);
    lines.push('curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);');
    if (ir.headers.length) {
      lines.push('curl_setopt($ch, CURLOPT_HTTPHEADER, [');
      for (const [k, v] of ir.headers) lines.push(`    ${dq(`${k}: ${v}`)},`);
      lines.push(']);');
    }
    if (ir.body.kind === 'text') lines.push(`curl_setopt($ch, CURLOPT_POSTFIELDS, ${dq(ir.body.text)});`);
    lines.push('$response = curl_exec($ch);', 'curl_close($ch);', 'echo $response;');
    return lines.join('\n');
  },
};

/* ---------------- Compiled ---------------- */

const goGen: Generator = {
  info: { id: 'go', label: 'Go', group: 'Compiled', extension: 'go' },
  generate(ir) {
    const bodyExpr =
      ir.body.kind === 'text' ? `strings.NewReader(${dq(ir.body.text)})` : 'nil';
    const lines = [
      'package main',
      '',
      'import (',
      '\t"fmt"',
      '\t"io"',
      '\t"net/http"',
      ...(ir.body.kind === 'text' ? ['\t"strings"'] : []),
      ')',
      '',
      'func main() {',
      `\treq, err := http.NewRequest(${dq(ir.method)}, ${dq(ir.url)}, ${bodyExpr})`,
      '\tif err != nil {\n\t\tpanic(err)\n\t}',
    ];
    for (const [k, v] of ir.headers) lines.push(`\treq.Header.Set(${dq(k)}, ${dq(v)})`);
    lines.push(
      '\tres, err := http.DefaultClient.Do(req)',
      '\tif err != nil {\n\t\tpanic(err)\n\t}',
      '\tdefer res.Body.Close()',
      '\tbody, _ := io.ReadAll(res.Body)',
      '\tfmt.Println(res.Status, string(body))',
      '}',
    );
    return lines.join('\n');
  },
};

const javaGen: Generator = {
  info: { id: 'java', label: 'Java (HttpClient)', group: 'Compiled', extension: 'java' },
  generate(ir) {
    const publisher =
      ir.body.kind === 'text'
        ? `HttpRequest.BodyPublishers.ofString(${dq(ir.body.text)})`
        : 'HttpRequest.BodyPublishers.noBody()';
    const lines = [
      'import java.net.URI;',
      'import java.net.http.HttpClient;',
      'import java.net.http.HttpRequest;',
      'import java.net.http.HttpResponse;',
      '',
      'public class Main {',
      '    public static void main(String[] args) throws Exception {',
      '        HttpRequest request = HttpRequest.newBuilder()',
      `            .uri(URI.create(${dq(ir.url)}))`,
    ];
    for (const [k, v] of ir.headers) lines.push(`            .header(${dq(k)}, ${dq(v)})`);
    lines.push(
      `            .method(${dq(ir.method)}, ${publisher})`,
      '            .build();',
      '        HttpResponse<String> response = HttpClient.newHttpClient()',
      '            .send(request, HttpResponse.BodyHandlers.ofString());',
      '        System.out.println(response.statusCode() + " " + response.body());',
      '    }',
      '}',
    );
    return lines.join('\n');
  },
};

const csharpGen: Generator = {
  info: { id: 'csharp', label: 'C# (HttpClient)', group: 'Compiled', extension: 'cs' },
  generate(ir) {
    const lines = [
      'using System.Net.Http;',
      'using System.Text;',
      '',
      'using var client = new HttpClient();',
      `using var request = new HttpRequestMessage(new HttpMethod(${dq(ir.method)}), ${dq(ir.url)});`,
    ];
    for (const [k, v] of ir.headers) {
      lines.push(`request.Headers.TryAddWithoutValidation(${dq(k)}, ${dq(v)});`);
    }
    if (ir.body.kind === 'text') {
      lines.push(`request.Content = new StringContent(${dq(ir.body.text)}, Encoding.UTF8, "application/json");`);
    }
    lines.push(
      'var response = await client.SendAsync(request);',
      'Console.WriteLine($"{(int)response.StatusCode} {await response.Content.ReadAsStringAsync()}");',
    );
    return lines.join('\n');
  },
};

const rustGen: Generator = {
  info: { id: 'rust', label: 'Rust (reqwest)', group: 'Compiled', extension: 'rs' },
  generate(ir) {
    const lines = [
      '// Cargo.toml: reqwest = { version = "0.12", features = ["blocking"] }',
      'fn main() -> Result<(), Box<dyn std::error::Error>> {',
      '    let client = reqwest::blocking::Client::new();',
      `    let mut req = client.request(reqwest::Method::from_bytes(b${dq(ir.method)})?, ${dq(ir.url)});`,
    ];
    for (const [k, v] of ir.headers) lines.push(`    req = req.header(${dq(k)}, ${dq(v)});`);
    if (ir.body.kind === 'text') lines.push(`    req = req.body(${dq(ir.body.text)});`);
    lines.push(
      '    let res = req.send()?;',
      '    println!("{} {}", res.status(), res.text()?);',
      '    Ok(())',
      '}',
    );
    return lines.join('\n');
  },
};

const swiftGen: Generator = {
  info: { id: 'swift', label: 'Swift (URLSession)', group: 'Mobile', extension: 'swift' },
  generate(ir) {
    const lines = [
      'import Foundation',
      '',
      `var request = URLRequest(url: URL(string: ${dq(ir.url)})!)`,
      `request.httpMethod = ${dq(ir.method)}`,
    ];
    for (const [k, v] of ir.headers) lines.push(`request.setValue(${dq(v)}, forHTTPHeaderField: ${dq(k)})`);
    if (ir.body.kind === 'text') lines.push(`request.httpBody = ${dq(ir.body.text)}.data(using: .utf8)`);
    lines.push(
      'let (data, response) = try await URLSession.shared.data(for: request)',
      'print((response as? HTTPURLResponse)?.statusCode ?? 0, String(decoding: data, as: UTF8.self))',
    );
    return lines.join('\n');
  },
};

const kotlinGen: Generator = {
  info: { id: 'kotlin', label: 'Kotlin (java.net)', group: 'Mobile', extension: 'kt' },
  generate(ir) {
    const lines = [
      'import java.net.URI',
      'import java.net.http.HttpClient',
      'import java.net.http.HttpRequest',
      'import java.net.http.HttpResponse',
      '',
      'fun main() {',
      '    val request = HttpRequest.newBuilder()',
      `        .uri(URI.create(${dq(ir.url)}))`,
    ];
    for (const [k, v] of ir.headers) lines.push(`        .header(${dq(k)}, ${dq(v)})`);
    const pub =
      ir.body.kind === 'text'
        ? `HttpRequest.BodyPublishers.ofString(${dq(ir.body.text)})`
        : 'HttpRequest.BodyPublishers.noBody()';
    lines.push(
      `        .method(${dq(ir.method)}, ${pub})`,
      '        .build()',
      '    val response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString())',
      '    println("${response.statusCode()} ${response.body()}")',
      '}',
    );
    return lines.join('\n');
  },
};

const dartGen: Generator = {
  info: { id: 'dart', label: 'Dart (http)', group: 'Mobile', extension: 'dart' },
  generate(ir) {
    const headers = ir.headers.length
      ? `, headers: {\n${ir.headers.map(([k, v]) => `    ${dq(k)}: ${dq(v)},`).join('\n')}\n  }`
      : '';
    const body = ir.body.kind === 'text' ? `, body: ${dq(ir.body.text)}` : '';
    return [
      "import 'package:http/http.dart' as http;",
      '',
      'Future<void> main() async {',
      `  final response = await http.Request(${dq(ir.method)}, Uri.parse(${dq(ir.url)}))`,
      '      .send();',
      '  final text = await response.stream.bytesToString();',
      '  print("${response.statusCode} $text");',
      '}',
      headers || body ? `// Equivalent request options: ${[headers, body].filter(Boolean).join(' ').trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  },
};

/* ---------------- Data / reference ---------------- */

const rawGen: Generator = {
  info: { id: 'raw', label: 'Raw HTTP', group: 'Data', extension: 'http' },
  generate(ir) {
    const url = new URL(ir.url);
    const target = `${url.pathname || '/'}${url.search}`;
    const lines = [`${ir.method} ${target} HTTP/1.1`, `Host: ${url.host}`];
    for (const [k, v] of ir.headers) lines.push(`${k}: ${v}`);
    let out = lines.join('\r\n') + '\r\n';
    if (ir.body.kind === 'text') out += `\r\n${ir.body.text}`;
    if (ir.body.kind === 'form') {
      out += `\r\n${ir.body.fields.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`;
    }
    return out;
  },
};

const harGen: Generator = {
  info: { id: 'har', label: 'HAR (HTTP Archive)', group: 'Data', extension: 'har' },
  generate(ir) {
    const entry = {
      request: {
        method: ir.method,
        url: ir.url,
        httpVersion: 'HTTP/1.1',
        headers: ir.headers.map(([name, value]) => ({ name, value })),
        queryString: Array.from(new URL(ir.url).searchParams, ([name, value]) => ({ name, value })),
        cookies: [],
        headersSize: -1,
        bodySize: ir.body.kind === 'text' ? ir.body.text.length : -1,
        postData:
          ir.body.kind === 'text'
            ? { mimeType: 'text/plain', text: ir.body.text }
            : ir.body.kind === 'form'
              ? {
                  mimeType: 'application/x-www-form-urlencoded',
                  params: ir.body.fields.map(([name, value]) => ({ name, value })),
                }
              : undefined,
      },
      response: {},
      cache: {},
      timings: { send: 0, wait: 0, receive: 0 },
    };
    return JSON.stringify(
      { log: { version: '1.2', creator: { name: 'cURL Toolkit', version: '1.0' }, entries: [entry] } },
      null,
      2,
    );
  },
};

/* ---------------- Registry ---------------- */

export const GENERATORS: Generator[] = [
  curlGen,
  wgetGen,
  httpieGen,
  powershellGen,
  pythonGen,
  jsFetchGen,
  nodeGen,
  rubyGen,
  phpGen,
  goGen,
  javaGen,
  csharpGen,
  rustGen,
  swiftGen,
  kotlinGen,
  dartGen,
  rawGen,
  harGen,
];

export function generateCode(req: RequestModel, language: LanguageId): string {
  const gen = GENERATORS.find((g) => g.info.id === language);
  if (!gen) throw new Error(`No generator for ${language}`);
  const ir = buildIR(req);
  const body = gen.generate(ir);
  const notes = ir.notes.length ? `\n\n// Notes:\n${ir.notes.map((n) => `// - ${n}`).join('\n')}` : '';
  return body + (language === 'har' || language === 'raw' ? '' : notes);
}

