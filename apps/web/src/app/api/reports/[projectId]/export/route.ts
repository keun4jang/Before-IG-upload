import { fail, handler } from '@/lib/http';
import { getStore } from '@/lib/store';
import { toJson, toMarkdown, toPrintableHtml } from '@/lib/services/report-service';

export const dynamic = 'force-dynamic';

type Ctx = { params: { projectId: string } };

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const format = new URL(req.url).searchParams.get('format') ?? 'md';
  const detail = await getStore().getProject(params.projectId);
  if (!detail) return fail('프로젝트를 찾을 수 없습니다.', 404);
  const result = detail.latestRun?.result;
  if (!result) return fail('분석 결과가 아직 없습니다. 먼저 검수를 실행하세요.', 409);

  // Content-Disposition 헤더는 latin1 만 허용하므로 한글 파일명은 RFC 5987 로 인코딩.
  const disposition = (ext: string) => {
    const utf8 = encodeURIComponent(`검수리포트-${detail.project.name}.${ext}`);
    return `attachment; filename="report.${ext}"; filename*=UTF-8''${utf8}`;
  };

  if (format === 'json') {
    return new Response(toJson(detail, result), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': disposition('json'),
      },
    });
  }
  if (format === 'print') {
    return new Response(toPrintableHtml(detail, result), {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
  return new Response(toMarkdown(detail, result), {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'content-disposition': disposition('md'),
    },
  });
});
