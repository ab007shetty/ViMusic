# ViMusic
Web-based solution for open-source Android-based music player - ViMusic. It uses the same database as theirs.

## Prerequisites

1. node.js https://nodejs.org/dist/v14.17.0/node-v14.17.0-x64.msi

## Installation

1. Clone the repository and Extract It.

2. Install NPM packages, on the root Directory of project

   ```sh
   npm install      
   ```

3. Change Live server URL's from App.jsx, SongCard.jsx, AccountSettingsModal.jsx, databaseUtils.js.

4. Create a .env file in root directory and Youtube V3 Data APi in the format, REACT_APP_YOUTUBE_API_KEY=xxxxxxxxxxxxxxxxxxx

5. Create serviceAccountKey.json file in root directory and add Firebase service account Keys


## Execution

1. Start the express server from the root directory

   ```sh
   npm start
   ```

2. If you wish you can change the default database else sign in with Google.
