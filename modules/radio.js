const Discord = require("discord.js");
var auth = require('../auth.json');
var songs = require('../songs.json').songs;

class Radio {

	constructor(bot) {
		console.log("Initializing radio.");
		this.client = bot;
		this.songInterrupt = false;
		this.songIndex = 0;
		this.shuffleSongs();
	}

	start_radio(callerVoiceChannel) {

		if (!callerVoiceChannel) {
			return -1;
		}

		if (this.currentChannel != callerVoiceChannel) {
			if (this.currentChannel != null) {
				this.songInterrupt = true;
				this.dispatcher.end();
				this.voiceConnection.disconnect();
				this.currentChannel.leave();
			}
			this.currentChannel = callerVoiceChannel;
		} else {
			return -2;
		}

		this.currentChannel.join()
			.then(connection => {
				console.log("Channel join success.");
				this.voiceConnection = connection;
				this.playNextSong();
			})
			.catch(error => {
				console.log(error);
				return -3;
			});

		return 1;

	}

	shuffle_playlist(callerVoiceChannel) {

		if (!callerVoiceChannel || callerVoiceChannel != this.currentChannel) {
			return -1;
		}

		this.shuffleSongs();

		if (this.dispatcher != null) {
			this.songInterrupt = true;
			this.dispatcher.end();
		}

		this.playNextSong();

	}

	skip_song(callerVoiceChannel) {

		if (!callerVoiceChannel || callerVoiceChannel != this.currentChannel) {
			return -1;
		}

		if (this.dispatcher != null) {
			this.songInterrupt = true;
			this.dispatcher.end();
		}

		this.playNextSong();

	}

	display_current_song() {
		if (!this.voiceConnection) return -1;

		let message = `🎵 **Currently playing:** ${songs[this.songIndex].title} - ${songs[this.songIndex].artist}`;

		return message;
	}

	display_playlist() {

		if (!this.voiceConnection) return -1;

		let message = `🎵 **Currently playing:** ${songs[this.songIndex].title} - ${songs[this.songIndex].artist}\n`;
		message += '        `' + this.dispatcher.time + '`\n\n';
		message += `**Up Next:**\n`;
		for (let i = 1 ; i <= 5 ; i++) {
			let index = (this.songIndex + i) % songs.length;
			message += `**${i}.**   ${songs[index].title} - ${songs[index].artist}\n`;
		}

		return message;
	}

	playNextSong() {
		this.songIndex = (this.songIndex + 1) % songs.length;
		let file = songs[this.songIndex].path;

		console.log(`At currentSongIndex[` + this.songIndex + `], playing from ${file}.`);

		// Set song status
		let statusMessage = songs[this.songIndex].title + ' - ' + songs[this.songIndex].artist
		this.client.user.setGame(statusMessage);

		if (file != null) {
			this.dispatcher = this.voiceConnection.playFile(file, { seek: 0, volume: 0.3 });
			if (this.dispatcher != null){
				this.dispatcher.once('end', () => {
					this.dispatcher = null;
					var numUserMembers = 0;

					for (let member of this.currentChannel.members.values()) {
						if (!member.user.bot) {
							numUserMembers++;
						}
					}
					if (numUserMembers > 0 && this.songInterrupt) {
						console.log("Song interrupt happened.");
						this.songInterrupt = false;
					} else if (numUserMembers > 0) {
						console.log("Regular song progression.");
						this.playNextSong();
					} else {
						this.voiceConnection.disconnect();
						this.currentChannel.leave();
						this.currentChannel = null;
						this.voiceConnection = null;
						this.client.user.setGame("!help");
					}
				});
			}
		} else {
			this.client.users.get(auth.admins[0]).sendMessage(`Something went wrong with Wafflebot on song index ` + this.songIndex + `, please check the logs.`);
		}

	}

	shuffleSongs() {
		for (let i = songs.length ; i ; i--) {
			let j = Math.floor(Math.random() * i);
			[songs[i - 1], songs[j]] = [songs[j], songs[i - 1]];
		}
	}

}

module.exports = Radio;
