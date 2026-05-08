export async function GET(request) {
  const { _posts } = await import('src/_mock');
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') || '';
  const post = _posts.find((item) => item.title === title) || _posts[0] || null;

  return Response.json({ post });
}
