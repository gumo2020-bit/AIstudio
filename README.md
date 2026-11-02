# 선택의 순간 — AI 윤리 딜레마

Vite + JavaScript + Supabase로 만든 한국어 설문 사이트입니다. GitHub에 업로드하고 Vercel로 배포할 수 있습니다. 기존 AI 스튜디오 프로젝트에 덧붙이는 패치가 아니라 **독립 실행 프로젝트**입니다.

## 1. 먼저 파일 구조 확인

| 파일 | 역할 |
| --- | --- |
| `supabase/01_schema.sql` | 테이블, 입력 검증, 제출 RPC, 통계 RPC, RLS |
| `supabase/02_seed.sql` | 예시 딜레마 3문항 |
| `src/main.js` | 참여 흐름, 관리자 로그인, 필터 통계 |
| `src/style.css` | 아이보리·주황·녹색 반응형 디자인 |
| `src/utils.js` | 입력 검증, 출력 이스케이프 |
| `.env.example` | 직접 입력할 환경변수 예시 |
| `vercel.json` | Vercel 빌드 설정 |
| `tests/validation.test.js` | 검증 및 출력 안전성 단위 테스트 |

테이블 SQL 전체는 `supabase/01_schema.sql`에 있습니다. 파일의 첫 부분부터 읽은 뒤 실행하세요.

| 테이블 | 내용 | 웹 이용자 접근 |
| --- | --- | --- |
| `questions` | 순서, 제목, 상황, A/B, 활성 여부, 변경 시각 | 활성 문항만 읽기 |
| `submissions` | 임의 UUID, 연령, 성별, 시각, 동의 버전, 제출 내용 | 직접 읽기/쓰기 불가 |
| `answers` | 문항별 선택·이유, 응답 당시 문항 사본 | 직접 읽기/쓰기 불가 |
| `admins` | 통계 조회가 가능한 Supabase Auth 사용자 UUID | 본인 등록 여부만 읽기 |

제출은 `submit_survey` 함수가 3문항·선택·이유·동의·문항 버전을 검사한 뒤 하나의 트랜잭션으로 저장합니다. 통계는 `get_stats` 함수가 관리자 UUID를 검사한 뒤 DB 전체에서 집계합니다. 일반 이용자는 함수 이름을 알아도 관리자 통계를 조회할 수 없습니다.

## 2. Supabase 테이블 만들기

1. https://supabase.com 에서 새 프로젝트를 만듭니다.
2. SQL Editor에서 새 쿼리를 열고 `supabase/01_schema.sql` 전체를 붙여 넣어 실행합니다. **새 프로젝트에서 한 번만 실행**하세요. 기존 동명 테이블이 있으면 새 프로젝트를 사용하거나 별도 마이그레이션이 필요합니다.
3. 다음 쿼리에 `supabase/02_seed.sql`을 붙여 넣어 실행합니다. 예시 3문항이 들어갑니다.
4. Table Editor의 `questions`에서 내용을 수정할 수 있습니다. `active=true` 문항은 정확히 3개, `position`은 서로 달라야 합니다.
5. 이미 응답이 쌓인 문항은 삭제하지 마세요. 수정하거나 비활성화하고 새 문항을 추가하세요. 기존 응답이 참조하므로 삭제가 제한됩니다.

문항을 수정하면 `updated_at`이 자동 변경됩니다. 이전/이후 응답은 통계에서 별도 버전으로 표시되며 이전 선택지 문구도 보존됩니다. 참여 도중 문항이 수정되었다면 제출이 거부되므로 페이지를 새로 열고 다시 참여해야 합니다.

## 3. 관리자 계정 만들기

1. Supabase의 Authentication → Users에서 관리자로 쓸 이메일·비밀번호 계정을 만듭니다. 이메일 인증 완료 상태로 만드세요.
2. 그 사용자의 **User UID**를 복사합니다.
3. SQL Editor에서 아래 `관리자_UUID`를 실제 값으로 바꿔 실행합니다.

```sql
insert into public.admins (user_id)
values ('관리자_UUID'::uuid)
on conflict do nothing;
```

로그인했다고 모두 관리자가 되지는 않습니다. 이 표에 등록된 사용자만 통계를 봅니다. 일반 회원가입 화면은 제공하지 않습니다. 필요하지 않으면 Supabase Auth에서 신규 가입 허용도 끄세요. 관리자 비밀번호는 코드나 환경변수에 적지 않습니다.

## 4. 연결 정보 입력 및 로컬 실행

Node.js 22.12 이상이 필요합니다.

프로젝트 설정의 API Keys에서 **Publishable key**와 Project URL을 찾으세요. 기존 프로젝트의 `anon` key도 지원합니다.

`.env.example`을 복사해 `.env` 파일을 만들고 아래 두 값을 직접 채웁니다.

```dotenv
VITE_SUPABASE_URL=https://실제프로젝트.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=실제_publishable_또는_anon_키
```

**주의:** Vite의 `VITE_` 환경변수는 브라우저 배포 코드에서 확인할 수 있습니다. `.env`가 키를 비밀로 만들어 주지는 않습니다. 따라서 브라우저용 Publishable/anon 키만 사용하며 실제 데이터 보호는 SQL의 권한과 RLS가 담당합니다. `service_role`, `sb_secret_...`, DB 비밀번호는 절대 넣지 마세요. 이 앱은 Gemini API를 호출하지 않으며 Gemini 키도 필요 없습니다.

프로젝트 폴더에서 터미널을 열고 순서대로 실행합니다.

```bash
npm ci
npm run dev
```

터미널에 표시된 주소로 접속합니다. 환경변수를 바꾸면 개발 서버를 다시 실행하세요.

```bash
npm test
npm run build
```

## 5. GitHub에 올리기 — 웹 화면 기준

1. ZIP 압축을 풉니다.
2. 기존 빈 GitHub 저장소의 **기존 파일을 업로드하여** 링크를 클릭합니다.
3. 압축을 푼 `ai-ethics` 폴더 **안의 파일과 폴더**를 드래그합니다. ZIP 자체를 업로드하지 마세요.
4. 저장소 첫 화면에 `package.json`, `index.html`, `src`, `supabase`가 바로 보이도록 합니다.
5. `Commit changes`를 누릅니다.
6. `.gitignore`와 `.env.example`도 포함되었는지 확인합니다. 파일 선택창에서 숨김 파일이 빠졌다면 따로 추가합니다. 실제 `.env`, `node_modules`, `dist`는 올리지 마세요.

Git 명령을 사용하려면 프로젝트 폴더에서 아래처럼 실행합니다. 주소는 자신의 저장소 주소로 바꾸세요. 기존 저장소에 파일이 있으면 먼저 내려받고 변경을 통합하세요. 강제 푸시는 필요 없습니다.

```bash
git init
git add .
git commit -m "Add AI ethics survey and admin statistics"
git branch -M main
git remote add origin https://github.com/사용자명/저장소명.git
git push -u origin main
```

## 6. Vercel 배포

1. https://vercel.com 에서 GitHub 계정으로 로그인합니다.
2. 새 프로젝트에서 방금 올린 저장소를 Import 합니다.
3. Framework Preset: Vite, Build Command: `npm run build`, Output Directory: `dist`를 확인합니다.
4. Environment Variables에 `.env.example`과 **동일한 이름**의 변수 2개와 실제 값을 추가합니다.
5. Deploy를 누르고 완료 후 주소를 엽니다.
6. 파일을 바깥 폴더째 올렸다면 Root Directory를 `package.json`이 있는 폴더로 지정합니다. 위 안내처럼 내용물만 올렸다면 기본값을 사용합니다.
7. 환경변수를 바꾼 뒤에는 Redeploy가 필요합니다.

관리자 통계는 화면 상단 링크 또는 `https://배포주소/#admin`으로 들어갑니다. 이메일·비밀번호 로그인을 사용하므로 이 프로젝트는 OAuth 리디렉션 설정이 필요하지 않습니다.

## 7. 실제 연결 후 확인할 순서

- 시작 → 연령/성별/동의 → 딜레마 3개 → 확인 → 제출 완료까지 진행합니다.
- 이유 5자 미만, 선택 누락, 비동의 상태에서는 진행할 수 없어야 합니다.
- 이전 화면으로 돌아갔을 때 입력값이 유지되는지 확인합니다.
- 완료 후 Supabase의 `submissions`에 1행, `answers`에 3행이 있는지 확인합니다.
- 로그아웃 상태와 관리자 미등록 계정에서 통계가 차단되는지 확인합니다.
- 관리자 계정에서 연령 범위와 성별 필터를 적용해 응답 수 및 A/B 비율을 확인합니다.
- 문항을 수정한 뒤 새로 응답해 이전/이후 버전이 따로 집계되는지 확인합니다.
- 네트워크 오류로 제출 결과가 불확실하면 같은 확인 화면에서 다시 제출합니다. 같은 UUID·내용은 한 번만 저장됩니다.

## 8. 운영 기준과 제한

- 새로고침하면 작성 중 응답이 초기화됩니다. 탭 안에서의 이전/다음 이동은 유지됩니다. 민감할 수 있는 이유를 로컬 저장소에 남기지 않는 구성입니다.
- 같은 제출 UUID의 재시도는 중복 저장되지 않습니다. 단, 다른 브라우저/새 설문으로 다시 참여하는 사람까지 막지는 않습니다.
- 통계는 관리자에게만 보이며 연령대·성별 인원, 문항별 A/B 인원·비율, 최근 50개 선택 이유를 제공합니다. 집계는 DB에서 수행하므로 1,000행 조회 제한으로 잘리지 않습니다.
- 응답 이유는 HTML로 실행되지 않도록 이스케이프하며 SQL은 입력값을 검증합니다.
- 공개 제출 RPC에는 CAPTCHA/사용자별 속도 제한이 없습니다. 공개 모집 등으로 넓게 운영할 경우 Edge Function의 CAPTCHA·속도 제한을 추가하세요.
- 수집 안내는 수업용 기본 문구입니다. 실제 운영 전에 `src/main.js`의 `countText`에 운영 목적에 맞는 보유기간·담당자·삭제 요청 방법을 보완하세요. 미성년자 대상 운영 절차도 학교 기준에 맞춰 확인하세요.
- 이 프로젝트에는 기존 응답 삭제 관리 UI가 없습니다. 보유기간이 끝난 응답은 Supabase에서 삭제하세요. `submissions` 삭제 시 연결된 `answers`도 함께 삭제됩니다.

공식 문서: [Supabase API 키](https://supabase.com/docs/guides/getting-started/api-keys), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Vite 환경변수](https://vite.dev/guide/env-and-mode), [Vercel Vite 배포](https://vercel.com/docs/frameworks/frontend/vite)
