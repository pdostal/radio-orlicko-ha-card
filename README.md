# radio-orlicko-ha-card

A Lovelace dashboard card for Home Assistant that displays the currently playing track on [Radio Orlicko](https://www.radioorlicko.cz/).

Requires the [radio-orlicko-ha](https://github.com/pdostal/radio-orlicko-ha) integration.

## Features

- Album art thumbnail
- Track title, artist, and album
- Current show and host name
- Animated progress bar with elapsed time
- Last.fm play count and listener statistics (when Last.fm API key is configured)
- Links to the Radio Orlicko website

## Installation

### HACS

1. Add this repository as a custom frontend repository in HACS
2. Install **Radio Orlicko Card**
3. Refresh your browser

### Manual

1. Copy `radio-orlicko-card.js` to your `config/www/` directory
2. In Home Assistant go to **Settings → Dashboards → Resources** and add:
   - URL: `/local/radio-orlicko-card.js`
   - Type: JavaScript module

## Configuration

```yaml
type: custom:radio-orlicko-card
entity: media_player.radio_orlicko
```

## License

MIT
