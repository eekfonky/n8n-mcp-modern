import https from 'node:https'
import http from 'node:http'
import { URL } from 'node:url'

export interface HttpOptions {
  headers?: Record<string, string>
  timeout?: number
  maxRedirects?: number
}

export interface HttpResponse {
  data: any
  status: number
  headers: Record<string, string>
}

export class SimpleHttpClient {
  private defaultTimeout = 30000
  private maxRedirects = 5

  async get(url: string, options: HttpOptions = {}): Promise<HttpResponse> {
    return this.request('GET', url, undefined, options)
  }

  async post(url: string, body: any, options: HttpOptions = {}): Promise<HttpResponse> {
    return this.request('POST', url, body, options)
  }

  async put(url: string, body: any, options: HttpOptions = {}): Promise<HttpResponse> {
    return this.request('PUT', url, body, options)
  }

  async delete(url: string, options: HttpOptions = {}): Promise<HttpResponse> {
    return this.request('DELETE', url, undefined, options)
  }

  async patch(url: string, body: any, options: HttpOptions = {}): Promise<HttpResponse> {
    return this.request('PATCH', url, body, options)
  }

  private async request(
    method: string,
    url: string,
    body?: any,
    options: HttpOptions = {},
    redirectCount = 0
  ): Promise<HttpResponse> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url)
      const isHttps = parsedUrl.protocol === 'https:'
      const client = isHttps ? https : http

      const requestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
        timeout: options.timeout || this.defaultTimeout,
      }

      const req = client.request(requestOptions, (res) => {
        let data = ''

        res.on('data', (chunk) => {
          data += chunk
        })

        res.on('end', () => {
          // Handle redirects
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            if (redirectCount >= (options.maxRedirects ?? this.maxRedirects)) {
              reject(new Error(`Too many redirects (${redirectCount})`))
              return
            }

            const redirectUrl = new URL(res.headers.location, url).toString()
            this.request(method, redirectUrl, body, options, redirectCount + 1)
              .then(resolve)
              .catch(reject)
            return
          }

          let parsedData: any = data
          try {
            if (data && res.headers['content-type']?.includes('application/json')) {
              parsedData = JSON.parse(data)
            }
          } catch {
            // Keep as string if not JSON
          }

          resolve({
            data: parsedData,
            status: res.statusCode || 0,
            headers: res.headers as Record<string, string>,
          })
        })
      })

      req.on('error', reject)
      req.on('timeout', () => {
        req.destroy()
        reject(new Error(`Request timeout after ${options.timeout || this.defaultTimeout}ms`))
      })

      if (body !== undefined) {
        const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
        req.write(bodyStr)
      }

      req.end()
    })
  }
}

export const httpClient = new SimpleHttpClient()