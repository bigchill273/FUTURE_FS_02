import { handleApiRequest } from '../../../server/api';

type RouteContext = {
  params: Promise<{ segments: string[] }>;
};

async function handle(request: Request, context: RouteContext) {
  const { segments } = await context.params;
  return handleApiRequest(request, segments);
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
