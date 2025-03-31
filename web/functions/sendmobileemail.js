export async function onRequest(context) {
  const url = new URL(context.request.url);
  const email = url.searchParams.get('email');

  const requestOrigin = context.request.headers.get("Origin");
  const allowedOrigins = ["https://freemusicdemixer.com", "https://pro.freemusicdemixer.com", "http://localhost:8788"];
  let corsHeader = 'Access-Control-Allow-Origin'; // Default to a restrictive policy

  if (allowedOrigins.includes(requestOrigin)) {
    corsHeader = requestOrigin; // Set to the request's origin if it's in the allowed list
  }

  const headers = {
    'Access-Control-Allow-Origin': corsHeader,
    'Access-Control-Expose-Headers': 'Content-Disposition'
  };

  if (!email) {
    return new Response('Email parameter is required', { status: 400, headers });
  }

  const postmarkRequest = {
      From: 'hello@freemusicdemixer.com', // must be a verified sender in Postmark
      To: email,
      Subject: 'Hello from Music Demixer!',
      TextBody: `Hello from Music Demixer!

We're thrilled that you found our website. This is a reminder to visit us on a desktop or laptop computer for the best results: https://freemusicdemixer.com/

Best regards,
Music Demixer team`
  };

  try {
    const resp = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': context.env.POSTMARK_SERVER_TOKEN
      },
      body: JSON.stringify(postmarkRequest)
    });

    if (!resp.ok) {
      // The Postmark request failed
      const errorText = await resp.text();
      console.error('Postmark error:', errorText);
      return new Response('Failed to send email via Postmark', {
        status: 500,
        headers
      });
    }

    // Postmark request succeeded
    return new Response('Email sent successfully!', {
      status: 200,
      headers
    });
  } catch (err) {
    console.error('Error calling Postmark:', err);
    return new Response('Postmark request failed', {
      status: 500,
      headers
    });
  }
}
