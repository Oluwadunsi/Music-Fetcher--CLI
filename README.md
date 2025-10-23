# Music-Fetcher--CLI

A Command Line Interface that integrates with the Spotify API to interact with and fetch music data, with the ability to save and play tracks using a MySQL database. **Now fully functional!**

## Motivation

The reason I chose to create this project was because I noticed a lot of CLI projects on GitHub and thought to myself, "I definitely could do this, and I did!" Inspired by the creativity and utility of CLI tools, I decided to build a music fetcher that leverages the Spotify API, adding my own twist with database integration for track management. This project reflects my growing skills in Node.js and my enthusiasm for tackling new challenges.

## Features

- **Search**: Fetch music tracks, albums, or artists from Spotify based on a query.
- **Save**: Store a selected track in a MySQL database.
- **List-Saved**: View all saved tracks with details like title, artist, and URL.
- **Play**: Open a saved track’s Spotify URL in your browser.

## Technologies

- **Node.js**: Runtime for the CLI.
- **JavaScript**: Core programming language.
- **MySQL**: Database for storing track information.
- **Axios**: HTTP client for Spotify API requests.
- **Commander**: CLI argument parsing.
- **Chalk**: Colored console output.
- **Open**: Opens URLs in the default browser.
- **Docker**: Optional containerization for MySQL (via `docker-compose`).

## Setup

### Prerequisites
- Node.js (v14 or later recommended)
- Docker Desktop (for Docker setup) or a local MySQL installation

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/music-fetcher-cli
   cd music-fetcher-cli

   <img width="950" height="705" alt="image" src="https://github.com/user-attachments/assets/743a03aa-f127-4642-a783-30babae9b2d3" />
