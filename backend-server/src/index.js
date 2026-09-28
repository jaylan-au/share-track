import express from 'express';

const app = express();
const port = process.env.PORT ?? 3000;

app.get('/health', (_request, response) => {
	response.json({ status: 'ok' });
});

app.listen(port, () => {
	console.log(`Backend server listening on port ${port}`);
});