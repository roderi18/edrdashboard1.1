export async function GET(request) {
  const { _posts } = await import('src/_mock');
  const { searchParams } = new URL(request.url);
  const query = String(searchParams.get('query') || '').trim().toLowerCase();
  const results = query
    ? _posts.filter((post) =>
        [post.title, post.description, ...(post.tags || [])]
          .join(' ')
          .toLowerCase()
          .includes(query)
      )
    : _posts;

  return Response.json({ results });
}
