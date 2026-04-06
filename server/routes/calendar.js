
const express = require('express');
const fs = require('fs');
const { google } = require('googleapis');
const bodyParser = require('body-parser');
const readline = require('readline');

const router = express.Router();
const cors = require('cors');

const app = express();

// Middleware

app.use(cors());
app.use(bodyParser.json());

const CREDENTIALS_PATH = 'C:\\Users\\LENOVO\\Desktop\\AIAppointmentnew\\Ai-Automated-Calling-\\server\\sources\\credentials.json';
const TOKEN_PATH = 'C:\\Users\\LENOVO\\Desktop\\AIAppointmentnew\\Ai-Automated-Calling-\\server\\sources\\token.json';

let oAuth2Client;

// Load credentials and authorize client
fs.readFile(CREDENTIALS_PATH, (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    try {
        const credentials = JSON.parse(content);
        authorize(credentials);
    } catch (parseError) {
        console.log('Error parsing client secret file:', parseError);
    }
});

function authorize(credentials) {
    const { client_secret, client_id, auth_uri, token_uri, redirect_uris } = credentials.web;

    if (!client_secret || !client_id || !auth_uri || !token_uri || !redirect_uris) {
        return console.error('Missing required credentials fields.');
    }

    oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getAccessToken(oAuth2Client);
        oAuth2Client.setCredentials(JSON.parse(token));
    });
}

function getAccessToken(oAuth2Client) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/calendar'],
        redirect_uri: 'http://localhost:3000/oauth2callback' // Update to match your registered redirect URI
    });
    console.log('Authorize this app by visiting this url:', authUrl);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error retrieving access token', err);
            oAuth2Client.setCredentials(token);

            // Store the token to disk for later program executions
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
        });
    });
}

// OAuth2 callback route
router.get('/oauth2callback', (req, res) => {
    const code = req.query.code;
    if (!code) {
        return res.status(400).send('Authorization code is missing.');
    }
    oAuth2Client.getToken(code, (err, token) => {
        if (err) return console.error('Error retrieving access token', err);
        oAuth2Client.setCredentials(token);

        // Store the token to a file for later use
        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
            if (err) return console.error(err);
            console.log('Token stored to', TOKEN_PATH);
            res.send('Authentication successful! You can close this window.');
        });
    });
});

// Route to fetch events from Google Calendar
router.get('/events', (req, res) => {
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    calendar.events.list({
        calendarId: 'primary',
        timeMin: (new Date()).toISOString(),
        showDeleted: false,
        singleEvents: true,
        orderBy: 'startTime',
    }, (err, response) => {
        if (err) {
            console.log('The API returned an error: ' + err);
            return res.status(500).json({ error: err });
        }
        const events = response.data.items.map(event => ({
            summary: event.summary,
            start: event.start.dateTime || event.start.date,
            end: event.end.dateTime || event.end.date
        }));
        res.json(events);
    });
});

// Route to create a new event
router.post('/events', (req, res) => {
    const { summary, location, description, startDateTime, endDateTime } = req.body;

    const event = {
        summary: summary,
        location: location,
        description: description,
        start: {
            dateTime: startDateTime,
            timeZone: 'America/Los_Angeles',
        },
        end: {
            dateTime: endDateTime,
            timeZone: 'America/Los_Angeles',
        },
    };

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    calendar.events.insert({
        calendarId: 'primary',
        resource: event,
    }, (err, event) => {
        if (err) {
            console.log('There was an error contacting the Calendar service: ' + err);
            return res.status(500).send('There was an error contacting the Calendar service.');
        }
        console.log('Event created: %s', event.data.htmlLink);
        res.status(200).send('Event created successfully');
    });
});

module.exports = router;
