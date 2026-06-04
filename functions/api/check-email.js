export async function onRequestPost(context) {
  // Always return a generic response — never reveal whether an email is registered
  return Response.json({ message: 'If this email is registered, you will receive a code.' });
}
