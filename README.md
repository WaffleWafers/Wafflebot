# Wafflebot
A bot made for personal use and for the UW osu! server.

## Commands
```
!help  - Show list of all commands.
!uptime  - Shows uptime.
!remindme <int> <unit> <"message"> - Reminds you with a PM.
!strawpoll <question> <[option1, option2, ...]> <duration> <m> - Creates a strawpoll.
!radio  - Starts a k-pop radio in your current voice channel.
!purge <int> or <message-id> - Deletes the past N messages or up to a certain message exclusive.
```

## Radio Commands
```
!radio - Starts a k-pop radio in your current voice channel.
!radio np  - Displays the song currently being played.
!radio peek  - Displays the current and next 5 songs on the playlist.
!radio shuffle  - Shuffle current playlist.
!radio skip  - Skips to next song in the playlist
```

## About !radio
Wafflebot streams music directly from your own downloaded music. In order for the radio to work, Wafflebot reads `songs.json` which contains the path for your music files. Change the path in `make_songs_json.py` to the directory containing your mp3/mp4 files and run.
```
python make_songs_json.py
```
Make sure you have [mutagen](https://mutagen.readthedocs.io/en/latest/) installed before running.

### Owned by Waffle#7503 
