#!/usr/bin/env node

require('dotenv').config();
const { Command } = require('commander');
const axios = require('axios');
const mysql = require('mysql2/promise');
const chalk = require('chalk');
const open = require('open');
const fs = require('fs').promises;
const path = require('path');

const program = new Command();
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const BASE_URL = 'https://api.spotify.com/v1';
const CACHE_FILE = path.join(__dirname, 'last-fetched-tracks.json');

// MySQL connection configuration
const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'root',
  database: process.env.MYSQL_DATABASE || 'music_fetcher',
};

// Store last fetched tracks for saving
let lastFetchedTracks = [];

// Get Spotify access token
async function getAccessToken() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Spotify Client ID or Secret not set in .env');
  }
  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  try {
    const response = await axios.post(
      'https://accounts.spotify.com/api/token',
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
    return response.data.access_token;
  } catch (error) {
    throw new Error('Error fetching access token: ' + error.message);
  }
}

// Load last fetched tracks from file
async function loadLastFetchedTracks() {
  try {
    const data = await fs.readFile(CACHE_FILE, 'utf8');
    lastFetchedTracks = JSON.parse(data);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(chalk.red(`Error loading cached tracks: ${error.message}`));
    }
    lastFetchedTracks = [];
  }
}

// Save last fetched tracks to file
async function saveLastFetchedTracks() {
  try {
    await fs.writeFile(CACHE_FILE, JSON.stringify(lastFetchedTracks, null, 2));
  } catch (error) {
    console.error(chalk.red(`Error saving cached tracks: ${error.message}`));
  }
}

// Search music
program
  .command('search')
  .description('Search for music tracks')
  .argument('<query>', 'Search query (e.g., artist, track name)')
  .option('--type <type>', 'Type to search (track, album, artist)', 'track')
  .option('--genre <genre>', 'Genre to filter by (e.g., pop, rock)')
  .option('--limit <number>', 'Number of results to return', '10')
  .action(async (query, options) => {
    try {
      const token = await getAccessToken();
      const url = `${BASE_URL}/search?q=${encodeURIComponent(query)}${
        options.genre ? `+genre:${options.genre}` : ''
      }&type=${options.type}&limit=${options.limit}`;
      const response = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      lastFetchedTracks = response.data.tracks.items;
      await saveLastFetchedTracks();

      if (lastFetchedTracks.length === 0) {
        console.log(chalk.yellow('No tracks found.'));
        return;
      }

      const tableData = lastFetchedTracks.map((track, index) => ({
        Index: index + 1,
        Track: track.name,
        Artist: track.artists[0].name,
        Album: track.album.name,
        URL: track.external_urls.spotify,
      }));
      console.table(tableData);
    } catch (error) {
      console.error(chalk.red(`Error searching music: ${error.message}`));
    }
  });

// Save track to MySQL
program
  .command('save')
  .description('Save the track to the database')
  .argument('<index>', 'Index of the track')
  .action(async (index) => {
    try {
      await loadLastFetchedTracks();
      if (lastFetchedTracks.length === 0) {
        console.error(chalk.red('No tracks available to save. Run a search command first.'));
        return;
      }
      const track = lastFetchedTracks[parseInt(index) - 1];
      if (!track) {
        console.error(chalk.red(`Track at index ${index} not found.`));
        return;
      }

      let connection;
      try {
        connection = await mysql.createConnection(dbConfig);
      } catch (error) {
        console.error(chalk.red(`Error connecting to MySQL: ${error.message}`));
        return;
      }

      const [existing] = await connection.execute('SELECT id FROM music_items WHERE spotify_url = ?', [
        track.external_urls.spotify,
      ]);
      if (existing.length > 0) {
        console.log(chalk.yellow(`Track "${track.name}" is already saved.`));
        await connection.end();
        return;
      }

      await connection.execute(
        'INSERT INTO music_items (title, artist, album, genre, spotify_url) VALUES (?, ?, ?, ?, ?)',
        [
          track.name,
          track.artists[0].name,
          track.album.name,
          track.genres ? track.genres[0] : 'unknown',
          track.external_urls.spotify,
        ]
      );
      await connection.end();

      console.log(chalk.green(`Track saved: ${track.name}`));
    } catch (error) {
      console.error(chalk.red(`Error saving track: ${error.message}`));
    }
  });

// List saved tracks
program
  .command('list-saved')
  .description('List all saved tracks')
  .option('--genre <genre>', 'Filter by genre')
  .action(async (options) => {
    let connection;
    try {
      connection = await mysql.createConnection(dbConfig);
    } catch (error) {
      console.error(chalk.red(`Error connecting to MySQL: ${error.message}`));
      return;
    }

    try {
      let query = 'SELECT * FROM music_items';
      let params = [];

      if (options.genre) {
        query += ' WHERE genre LIKE ?';
        params = [`%${options.genre}%`];
      }

      const [tracks] = await connection.execute(query, params);
      await connection.end();

      if (tracks.length === 0) {
        console.log(chalk.yellow('No saved tracks found.'));
        return;
      }

      console.log(chalk.blue('\nSaved Tracks:'));
      console.table(
        tracks.map((track) => ({
          ID: track.id,
          Track: track.title,
          Artist: track.artist,
          Album: track.album,
          Genre: track.genre,
          URL: track.spotify_url,
          Saved: track.saved_at,
        }))
      );
    } catch (error) {
      console.error(chalk.red(`Error listing tracks: ${error.message}`));
    }
  });

// Play saved track
program
  .command('play')
  .description('Open a saved track in Spotify')
  .argument('<id>', 'Track ID')
  .action(async (id) => {
    let connection;
    try {
      connection = await mysql.createConnection(dbConfig);
      const [tracks] = await connection.execute('SELECT spotify_url FROM music_items WHERE id = ?', [id]);
      await connection.end();
      if (tracks.length === 0) {
        console.error(chalk.red(`Track with ID ${id} not found.`));
        return;
      }
      console.log(chalk.green(`Track URL: ${tracks[0].spotify_url}`));
      try {
        await open(tracks[0].spotify_url);
        console.log(chalk.green(`Opening track in Spotify...`));
      } catch (error) {
        console.log(chalk.yellow(`Could not open browser. Please visit: ${tracks[0].spotify_url}`));
      }
    } catch (error) {
      console.error(chalk.red(`Error opening track: ${error.message}`));
    }
  });

program.parse(process.argv);