# Third-party notices — Invoice · Receipt · P&L Generator

This app loads the following open-source libraries. Each remains under its own
license; nothing here changes those terms. Files are vendored unmodified.

| Library | Version | License | Vendored file |
|---|---|---|---|
| jsPDF | 4.2.1 | MIT | `assets/vendor/jspdf.umd.min.js` |
| jspdf-autotable | 5.0.9 | MIT | `assets/vendor/jspdf.plugin.autotable.min.js` |
| SheetJS (xlsx) | 0.18.5 | Apache-2.0 | `assets/vendor/xlsx.full.min.js` |
## License texts


### MIT — jsPDF, jspdf-autotable

```
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### Apache-2.0 — SheetJS (xlsx)

```
Apache License, Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0)

Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
CONDITIONS OF ANY KIND, either express or implied. See the License for the
specific language governing permissions and limitations under the License.

SheetJS Community Edition — https://sheetjs.com — includes the `cpexcel`
codepage tables, also Apache-2.0.
```

---

## 무료 AI 체험 서버

`engines/free-ai-client.js`는 이 저장소의 Cloudflare Worker
(`free-ai-taste.onetap-ai.workers.dev`)를 호출하는 클라이언트입니다.
이 파일은 이 프로젝트의 코드이며, 외부 라이브러리를 포함하지 않습니다.
무료 체험은 외부 AI 제공자(Cloudflare Workers AI / Google Gemini / Groq)로
전송되며, 앱은 그 사실을 화면에 안내합니다.
