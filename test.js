fetch('https://openrouter.ai/api/v1/models')
  .then(r => r.json())
  .then(d => {
    const freeModels = d.data.filter(m => m.pricing.prompt === '0' || m.id.endsWith(':free')).map(m => m.id);
    console.log(freeModels);
  });
