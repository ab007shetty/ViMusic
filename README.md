# ViMusic
Web-based solution for open-source Android-based music player - ViMusic. It uses the same database as theirs.

## Installation

1. Clone the repository and Extract It.

2. Install NPM packages, on the root Directory of project

   ```sh
   npm install      
   ```

3. Change Live server URL's in AccountSettingsModal.jsx and databaseUtils.js.

4. Create serviceAccountKey.json file in root directory and add Firebase service account Keys.

5. Create a .env file in root directory and below key/values.

	```sh
	REACT_APP_YOUTUBE_API_KEY=AIzaxxxxxxxxxxxxxxxxxx
	REACT_APP_LOCAL_SERVER_URL=http://localhost:5000/api
	REACT_APP_LIVE_SERVER_URL=https://vimusic.up.railway.app/api   ```

## Execution

1. Start the express server from the root directory

   ```sh
   npm start
   ```

2. If you wish you can change the default database else sign in with Google.
