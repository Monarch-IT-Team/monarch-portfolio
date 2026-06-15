const fs = require('fs');

async function testAudio() {
  const OPENROUTER_API_KEY = "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";
  // Fake small webm base64 (just a header to test if the API accepts the format)
  const fakeWebm = "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGkVvI0uDxgMacXVhbnR1bS53ZWJtQoeBAkKFgQI="; 
  
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { 
          role: 'user', 
          content: [
            { type: "text", text: "What is this?" },
            { type: "image_url", image_url: { url: `data:audio/webm;base64,${fakeWebm}` } }
          ]
        }
      ]
    })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

testAudio();
