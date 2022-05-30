const jsforce = require('jsforce');
const fastify = require('fastify');
const fastifySession = require('@fastify/session');
const fastifyCookie = require('@fastify/cookie');
const {
    S3Client,
    HeadObjectCommand,
    GetObjectCommand
} = require('@aws-sdk/client-s3');

// Check and retrieve environment variables
require('dotenv').config();
[
    'SF_LOGIN_URL',
    'SF_AUTH_CALLBACK_URL',
    'SF_CONSUMER_KEY',
    'SF_CONSUMER_SECRET',
    'SF_API_VERSION',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION',
    'AWS_S3_BUCKET',
    'SESSION_SECRET'
].forEach((varName) => {
    if (!process.env[varName]) {
        console.error(`Missing ${varName} environment variable`);
        process.exit(-1);
    }
});
const {
    SF_LOGIN_URL,
    SF_AUTH_CALLBACK_URL,
    SF_CONSUMER_KEY,
    SF_CONSUMER_SECRET,
    SF_API_VERSION,
    AWS_REGION,
    AWS_S3_BUCKET,
    SESSION_SECRET,
    SESSION_DURATION
} = process.env;

// Get session settings
const maxAge = SESSION_DURATION
    ? parseInt(SESSION_DURATION, 10) * 60 * 1000
    : 120 * 60 * 1000;
const secure = SF_AUTH_CALLBACK_URL.startsWith('https://');

// Prepare server
const app = fastify({ logger: true });
app.register(fastifyCookie);
app.register(fastifySession, {
    secret: SESSION_SECRET,
    maxAge,
    cookie: { secure }
});

// Prepare Salesforce client OAuth configuration
const oauth2 = new jsforce.OAuth2({
    loginUrl: SF_LOGIN_URL,
    clientId: SF_CONSUMER_KEY,
    clientSecret: SF_CONSUMER_SECRET,
    redirectUri: SF_AUTH_CALLBACK_URL
});

/**
 * Attemps to retrieves the server session.
 * If there is no session, redirects to the login/authorization URL
 */
function checkAndRetrieveSalesforceClient(request, response) {
    const { session } = request;
    if (!session.accessToken) {
        // Save original URL for redirect after auth
        session.orginalUrl = `${request.protocol}://${request.hostname}${request.url}`;
        // Redirect to Salesforce login/authorization URL
        response.redirect(oauth2.getAuthorizationUrl({ scope: 'api' }));
        return null;
    } else {
        session.touch(); // Keep session alive
        return new jsforce.Connection({
            instanceUrl: session.instanceUrl,
            accessToken: session.accessToken,
            version: SF_API_VERSION
        });
    }
}

/**
 * Checks permissions and downloads the requested file from S3
 */
async function downloadFile(sfClient, s3Key, response) {
    // Get S3 file metadata
    const s3Client = new S3Client({ region: AWS_REGION });
    const s3Input = {
        Bucket: AWS_S3_BUCKET,
        Key: s3Key
    };
    const s3Metatada = await s3Client.send(new HeadObjectCommand(s3Input));
    const entityId = s3Metatada.Metadata['sfdc-linked-entity-id'];
    //const ownerId = s3Metatada.Metadata['sfdc-owner-id'];
    const entityApiName = s3Metatada.Metadata['sfdc-linked-entity-api-name'];
    const fileName = s3Key.substring(entityId.length + 1); // Remove entity Id and slash

    // Check read permission by trying to access Salesforce record with current user
    await testSfRecordPermissions(sfClient, entityApiName, entityId);

    // Download S3 file
    response.raw.setHeader(
        'Content-Disposition',
        `attachment; filename="${fileName}"`
    );
    response.raw.setHeader('Content-Type', s3Metatada.ContentType);
    response.raw.setHeader('Content-Length', s3Metatada.ContentLength);
    const byteStream = await s3Client.send(new GetObjectCommand(s3Input));
    byteStream.Body.pipe(response.raw);
}

async function testSfRecordPermissions(sfClient, entityApiName, entityId) {
    return new Promise((resolve, reject) => {
        sfClient.sobject(entityApiName).retrieve(entityId, (err, record) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

/**
 * Login callback endpoint (only called by Salesforce)
 */
app.get('/auth/callback', (request, response) => {
    if (!request.query.code) {
        response
            .code(500)
            .send('Failed to get authorization code from server callback.');
        return;
    }
    if (!request.session.orginalUrl) {
        response.code(500).send('Failed to retrieve download URL.');
        return;
    }

    // Authenticate with OAuth
    const sfClient = new jsforce.Connection({
        oauth2,
        version: SF_API_VERSION
    });
    sfClient.authorize(request.query.code, (error, userInfo) => {
        if (error) {
            app.log.error(
                'Salesforce authorization error: ' + JSON.stringify(error)
            );
            response.code(500).serialize(error);
            return;
        }
        app.log.info(`Logged in Salesforce as user ${userInfo.id}`);

        // Store OAuth session data in server (never expose it directly to client)
        const { session } = request;
        session.instanceUrl = sfClient.instanceUrl;
        session.accessToken = sfClient.accessToken;
        session.userId = userInfo.id;

        // Redirect to original URL
        const urlString = session.orginalUrl;
        session.orginalUrl = undefined;
        response.redirect(urlString);
    });
});

app.get('/download', (request, response) => {
    const sfClient = checkAndRetrieveSalesforceClient(request, response);
    if (sfClient) {
        // Parse download URL
        const downloadUrl = new URL(
            `${request.protocol}://${request.hostname}${request.url}`
        );
        const s3UrlString = downloadUrl.searchParams.get('url');
        const s3Key = new URL(s3UrlString).pathname.substring(1);
        // Download file
        app.log.info(
            `User ${request.session.userId} attempting to download ${s3UrlString}`
        );
        downloadFile(sfClient, s3Key, response);
    }
});

// Start the server
const start = async () => {
    try {
        await app.listen(process.env.PORT ? process.env.PORT : 3000, '0.0.0.0');
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
};
start();
