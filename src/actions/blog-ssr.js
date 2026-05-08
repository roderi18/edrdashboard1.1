export async function getPosts() {
  const { _posts } = await import('src/_mock');

  return { posts: _posts };
}

// ----------------------------------------------------------------------

export async function getPost(title) {
  const { _posts } = await import('src/_mock');
  const post = _posts.find((item) => item.title === title) || _posts[0] || null;

  return { post };
}

// ----------------------------------------------------------------------

export async function getLatestPosts() {
  const { _posts } = await import('src/_mock');

  return { latestPosts: _posts };
}
