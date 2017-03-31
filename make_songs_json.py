# NOTE: THIS REQUIRES MUTAGEN INSTALLED
from mutagen.id3 import ID3
from mutagen.mp4 import MP4

import glob, json, io

# Change value to directory containing mp3/m4a files.
music_directory = "/Users/wafflewafers/Music/korean/"

mp3_files = glob.glob(music_directory + "*.mp3")
m4a_files = glob.glob(music_directory + "*.m4a")

files = mp3_files + m4a_files

titles = []
artists = []

for file in mp3_files:
	audio = ID3(file)
	titles.append(audio["TIT2"].text[0])
	artists.append(audio["TPE1"].text[0])

for file in m4a_files:
	tags = MP4(file).tags
	titles.append(tags["\xa9nam"])
	artists.append(tags["\xa9ART"])

songs = []
for i in range(0, len(files)):
	song = {}
	song['title'] = titles[i]
	song['artist'] = artists[i]
	song['path'] = files[i]
	songs.append(song)

collection = {}
collection['songs'] = songs
json_data = json.dumps(collection)
json_data = json.loads(json_data)

with io.open('songs.json', 'w', encoding='utf-8') as f:
  f.write(json.dumps(json_data, indent=4, sort_keys=True, ensure_ascii=False))

# with open('songs.json', 'w') as outfile:
#     json.dump(collection, outfile)