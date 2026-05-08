export async function GET() {
  const { _posts } = await import('src/_mock');

  return Response.json({ latestPosts: _posts });
}
