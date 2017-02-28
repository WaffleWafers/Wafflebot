# Wafflebot
A bot made for personal use and for the UW osu! server.

## Commands
```
!help  - Show list of all commands.
!uptime  - Shows uptime.
!remindme <int> <unit> <"message"> - Reminds you with a PM.
!strawpoll <question> <[option1, option2, ...]> <duration> - Creates a strawpoll.
!radio  - Starts a k-pop radio in your current voice channel.
!purge <int> or <message-id> - Deletes the past N messages or up to a certain message exclusive.
```

## Radio
Wafflebot streams music directly from your own downloaded music. In order for the radio to work, Wafflebot reads `songs.json` which contains the path for your music files. Change the path in `make_songs_json.py` to the directory containing your mp3/mp4 files and run.
```
python make_songs_json.py
```
Make sure you have [mutagen](https://mutagen.readthedocs.io/en/latest/) installed before running.

### Owned by Waffle#7503 
