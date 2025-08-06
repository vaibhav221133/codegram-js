import swaggerAutogen from 'swagger-autogen';
import path from 'path'; // Import path module
import { fileURLToPath } from 'url'; // Import fileURLToPath for __dirname equivalent

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const doc = {
  info: {
    title: 'CodeGram API',
    version: '1.0.0',
    description: 'API documentation for the CodeGram social media application for developers.',
  },
  servers: [
    {
      url: 'http://localhost:3001',
      description: 'Development server'
    }
  ],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'connect.sid',
      },
    }
  },
};

// Use path.resolve to ensure absolute path for output file
const outputFile = path.resolve(__dirname, './swagger-output.json');
// Use path.resolve for endpointsFiles as well for consistency
const endpointsFiles = [
    path.resolve(__dirname, './src/app.js') // Ensure this points correctly to your app.js
];

// Generate the OpenAPI specification file
swaggerAutogen({ openapi: '3.0.0' })(outputFile, endpointsFiles, doc).then(() => {
    console.log("OpenAPI specification file has been generated successfully.");
    console.log(`File located at: ${outputFile}`); // Add logging for confirmation
}).catch(err => {
    console.error("Error generating OpenAPI specification file:", err); // Log errors
});