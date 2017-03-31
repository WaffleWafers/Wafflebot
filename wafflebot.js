var auth = require('./auth.json');
var songs = require('./songs.json').songs;
var iuimages = require('./iuimages.json').paths;
const async = require('async');
const Discord = require("discord.js");
const moment = require('moment');
const mongoose = require('mongoose');
const request = require('request');
const yt = require('ytdl-core');

const bot = new Discord.Client();

mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost/wafflebot');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));

var reminderSchema = mongoose.Schema({
    authorId: String,
    message: String,
    time: Date
});

var strawpollSchema = mongoose.Schema({
    pollId: String,
    channelId: String,
    authorId: String,
    time: Date
});

var Reminder = mongoose.model('Reminder', reminderSchema);
var Strawpoll = mongoose.model('Strawpoll', strawpollSchema);

var botDefaultStatus = `!help`;
var currentSongIndex = 0;
var dispatcher;
var startTime;
var voiceChannel;
var voiceConnection;
var songInterrupt = false;

const commands = {
    '!help': {
        description: `Show list of all commands.`,
        isAdminCommand: false,
        availableByDM: true,
        expectedArgs: 0,
        run: function(msg, args) {
            let message = `**Command List**\n`;
            for (let key in commands) {
                if (!commands.hasOwnProperty(key)) continue;
                if (commands[key].isAdminCommand) continue;
                message += (`${key} ${commands[key].expectedArgs > 0 || commands[key].expectedArgs == -1 ? commands[key].argDescription : ''} - *${commands[key].description}*\n`);
            }
            msg.channel.sendMessage(message);
        }
    },
    '!username': {
        description: `Change name of bot. (2 hour cooldown)`,
        argDescription: `<username>`,
        isAdminCommand: true,
        availableByDM: true,
        expectedArgs: -1,
        run: function(msg, args) {
            if (args.length == 0) return;
            let username = args.join(' ');
            changeUsername(username);
        }
    },
    '!status': {
        description: `Set current playing of bot.`,
        argDescription: `<game>`,
        isAdminCommand: true,
        availableByDM: true,
        expectedArgs: -1,
        run: function(msg, args) {
            if (args.length == 0) return;
            let game = args.join(' ');
            setStatus(game);
        }
    },
    '!uptime': {
        description: `Shows uptime.`,
        isAdminCommand: false,
        availableByDM: true,
        expectedArgs: 0,
        run: function(msg, args) {
            let currentTime = moment();
            let timeDifference = currentTime.diff(startTime);
            let duration = moment.duration(timeDifference);
            let uptime = Math.floor(duration.asHours()) + moment.utc(timeDifference).format(":mm:ss");

            msg.channel.sendMessage(`**Total uptime:** ${uptime}`);
        }
    },
    '!iu': {
        description: `Bless the channel.`,
        isAdminCommand: false,
        availableByDM: true,
        expectedArgs: 0,
        run: function(msg, args) {
            let imagePath = iuimages[Math.floor(Math.random() * iuimages.length)];
            msg.channel.sendFile(imagePath).catch(console.error);
        }
    },
    '!remindme': {
        description: `Reminds you with a PM.`,
        argDescription: `<int> <unit> <"message">`,
        isAdminCommand: false,
        availableByDM: true,
        expectedArgs: -1,
        run: function(msg, args) {
            let authorId = msg.author.id;
            if (!/"(.*)"/.test(msg.content)) return;
            let message = /"(.*)"/.exec(msg.content)[1];
            let time = /!remindme *([^"]*) /.exec(msg.content)[1];
            let reminderTime = processDate(time);
            if (reminderTime == null) return;
            var reminder = new Reminder({
                authorId: authorId,
                message: message,
                time: reminderTime
            });
            reminder.save(function(err, reminder) {
                if (err) {
                    msg.channel.sendMessage(`Oops! Something went wrong with saving your reminder on our end.`);
                    console.log(err);
                } else {
                    msg.channel.sendMessage(`Noted!`);
                }
            });
        }

    },
    '!clearreminders': {
        description: `Clears all saved reminders.`,
        isAdminCommand: true,
        availableByDM: true,
        expectedArgs: 0,
        run: function(msg, args) {
            Reminder.remove({}, function(err) {
                if (err) {
                    msg.channel.sendMessage(`Oop! Something went wrong with clearing the reminder collection.`);
                    console.log(err);
                } else {
                    console.log('Reminder collection removed');
                }
            });
        }
    },
    '!sendreminders': {
        description: `Sends all due reminders.`,
        isAdminCommand: true,
        availableByDM: true,
        expectedArgs: 0,
        run: function(msg, args) {
            sendReminders();
        }
    },
    '!strawpoll': {
        description: `Creates a strawpoll.`,
        argDescription: `<question> <[option1, option2, ...]> <duration> <m>`,
        isAdminCommand: false,
        availableByDM: false,
        expectedArgs: -1,
        run: function(msg, args) {
            if (!/ \[(.*)\]/.test(msg.content)) return;
            let question = /!strawpoll ([^\[\]]*) /.exec(msg.content)[1];
            let options = / \[(.*)\]/.exec(msg.content)[1].split(',').map( (e) => { return e.trim(); } );
            if (options.length == 0 || question.length == 0) return;
            message = msg.content.trim();
            let isMulti = false;
            if (args[args.length - 1] == 'm') {
                message = message.slice(0, -2);
                isMulti = true;
            }
            let duration = '';
            if (/] (.*)/.test(message)) {
                duration = /] (.*)/.exec(message)[1];
            }
            let endTime = processDate(duration);
            if (endTime == null) endTime = processDate('1 hour');
            
            initStrawpoll(msg, question, options, endTime, isMulti);
        }
    },
    '!radio': {
        description: `Starts a k-pop radio in your current voice channel.`,
        argDescription: ``,
        isAdminCommand: false,
        availableByDM: false,
        expectedArgs: -1,
        run: function(msg, args) {
            callerVoiceChannel = msg.member.voiceChannel;

            if (!callerVoiceChannel) {
                return msg.reply(`Please be in a voice channel first!`);
            }

            if (args.length > 0) {
                command = args[0];
                radioArgs = args.slice(1);
                if (!(command in radioCommands)) return msg.reply('see the radio commands with `!radio help`.');
                if (radioCommands[command].expectedArgs != radioArgs.length && commands[command].expectedArgs != -1) return;

                radioCommands[command].run(msg, radioArgs);
                return;
            }

            if (callerVoiceChannel == voiceChannel) {
                return msg.reply(`The radio is already in your channel.`);
            }

            if (voiceConnection) {
                voiceChannel.leave();
                voiceConnection.disconnect();
            }

            voiceChannel = callerVoiceChannel;

            voiceChannel.join()
                .then(connection => {
                    voiceConnection = connection;
                    if (dispatcher != null) {
                        songInterrupt = true;
                        dispatcher.end();
                    }
                    playNextSong(voiceChannel);
                });
        }
    },
    '!purge': {
        description: `Deletes the past up to 99 messages sent or up to a certain message exclusive. (mods only)`,
        argDescription: `<int> or <message-id>`,
        isAdminCommand: false,
        availableByDM: false,
        expectedArgs: -1,
        run: function(msg, args) {
            if (!msg.guild.member(msg.author).hasPermission("MANAGE_MESSAGES")) return;

            let channel = msg.channel;

            let param = args[0];
            let isNumMessages = false;
            if (!isNaN(param) && param < 0) return;
            if (!isNaN(param) && param < 100) {
                isNumMessages = true;
                param = Number(param) + 1;
            } else if (!isNaN(param) && param < 10000000000000000) {
                msg.channel.sendMessage('You can only purge up to 99 messages at a time. Sorry!');
            } else {
                msg.channel.fetchMessage(param).then(
                    function(message) {
                        console.log(message.content);
                    },
                    function(reason) {
                        msg.channel.sendMessage('Unable to find message with the id: `' + param + '`');
                        return;
                    }
                )
            }

            let fetchQuery = isNumMessages ? {limit: param} : {limit: 100, after: param};
            
            channel.fetchMessages(fetchQuery).then(
                function(messages) {
                    channel.bulkDelete(messages).catch(
                            function(reason) {
                                // Probably because you can't delete messages 2 weeks or older.
                                // Or you're trying to purge without permissions.
                                console.log('Error purging messages: ' + reason);
                            }
                        )
                },
                function(reason) {
                    // You're trying to delete too many messages at once.
                    console.log('Error fetching messages to purge: ' + reason);
                }
            );
        }
    },
};

const radioCommands = {
    'help': {
        description: `Show list of all commands.`,
        expectedArgs: 0,
        run: function(msg, args) {
            let message = `**Radio Commands**\n`;
            message += (`!radio - *${commands['!radio'].description}*\n`);
            for (let key in radioCommands) {
                if (!radioCommands.hasOwnProperty(key)) continue;
                if (key == 'help') continue;
                message += (`!radio ${key} ${radioCommands[key].expectedArgs > 0 || radioCommands[key].expectedArgs == -1 ? radioCommands[key].argDescription : ''} - *${radioCommands[key].description}*\n`);
            }
            msg.channel.sendMessage(message);
        }
    },
    'np': {
        description: `Displays the song currently being played.`,
        expectedArgs: 0,
        run: function(msg, args) {
            if (!voiceConnection) return;
            message = `🎵 **Currently playing:** ${songs[currentSongIndex].title} - ${songs[currentSongIndex].artist}`;
            msg.channel.sendMessage(message);
        }
    },
    'peek': {
        description: `Displays the current and next 5 songs on the playlist.`,
        expectedArgs: 0,
        run: function(msg, args) {
            if (!voiceConnection) return;
            message = `🎵 **Currently playing:** ${songs[currentSongIndex].title} - ${songs[currentSongIndex].artist}\n\n`;
            message += `**Up Next:**\n`;
            for (let i = 1 ; i <= 5 ; i++) {
                index = (currentSongIndex + i) % songs.length;
                message += `**${i}.**   ${songs[index].title} - ${songs[index].artist}\n`;
            }
            msg.channel.sendMessage(message);
        }
    },
    'shuffle': {
        description: `Shuffle current playlist.`,
        expectedArgs: 0,
        run: function(msg, args) {
            if (!voiceConnection) return;
            callerVoiceChannel = msg.member.voiceChannel;
            if (callerVoiceChannel == null || callerVoiceChannel != voiceChannel) {
                return msg.reply(`You must be in the radio's channel to shuffle.`);
            }
            shuffleSongs();
            if (dispatcher != null) {
                songInterrupt = true;
                dispatcher.end();
            }
            playNextSong(callerVoiceChannel);
        }
    },
    'skip': {
        description: `Skips to next song in the playlist.`,
        expectedArgs: 0,
        run: function(msg, args) {
            if (!voiceConnection) return;
            callerVoiceChannel = msg.member.voiceChannel;
            if (callerVoiceChannel == null || callerVoiceChannel != voiceChannel) {
                return msg.reply(`You must be in the radio's channel to shuffle.`);
            }
            if (dispatcher != null) {
                songInterrupt = true;
                dispatcher.end();
            }
            playNextSong(callerVoiceChannel);
        }
    },
}

function changeUsername(text) {
    bot.user.setUsername(text)
        .then(user => console.log(`My new username is ${user.username}`))
        .catch(console.log('Your username change is probably on cooldown.'));
}

function changeAvatar(path) {
    bot.user.setAvatar(path)
        .then(user => console.log(`New avatar set!`))
        .catch(console.error);
}

function setStatus(game) {
    console.log(game);
    bot.user.setGame(game)
        .then(user => console.log(`Successfully set status!`))
        .catch(console.log(`Failed to set status.`));
}

var checkPeriodics = function() {
    sendReminders();
    sendStrawpollResults();
}

function sendReminders() {
    Reminder.find({
            time: { $lte: Date.now() }
        },
        function(err, reminders) {
            if (err) {
                console.log(`An error occurred while querying for reminders.`);
                return;
            }
            async.each(reminders, function(reminder) {
                if (!reminders) return;

                let userId = reminder.authorId;
                let message = reminder.message;
                let date = new Date(reminder.time);
                bot.users.get(userId).sendMessage(``, {embed: {
                    color: 16711680,    //red
                    title: 'Reminder!',
                    description: message,
                    timestamp: date,
                }});
                console.log(`A reminder was sent!`);
                reminder.remove();
            });
        }
    );
}

function sendStrawpollResults() {
    Strawpoll.find({
            time: { $lte: Date.now() }
        },
        function(err, polls) {
            if (err) {
                console.log(`An error occurred while querying for polls.`);
                return;
            }
            async.each(polls, function(poll) {
                if (!polls) return;

                request('https://strawpoll.me/api/v2/polls/' + poll.pollId,
                    function (error, response, body) {
                        if (!error && response.statusCode == 200) {
                            let outputString = '';
                            let info = JSON.parse(body);

                            for (let i = 0 ; i < info.options.length ; i++) {
                                let lineLength = 40;
                                let optionLengthCap = 27;
                                let option = info.options[i].toString();
                                if (option.length > optionLengthCap) option = option.slice(0, optionLengthCap - 3) + '...';
                                let votes = info.votes[i].toString();
                                outputString += option + ' ' + '-'.repeat(lineLength - option.length - votes.length - 2) + ' ' + votes + '\n';
                            }

                            outputString = '```\n' + outputString + '```';

                            bot.channels.get(poll.channelId).sendMessage(
                                '@here', {embed: {
                                color: 16711680,
                                title: 'RESULTS: ' + info.title,
                                description: outputString,
                                timestamp: new Date(),
                                footer: {
                                    icon_url: bot.users.get(poll.authorId).avatarURL,
                                    text: 'http://strawpoll.me/' + info.id,
                                }
                            }});

                            console.log('A strawpoll result was sent!');
                            poll.remove();

                        } else {
                            console.log('some sort of failure: ' + response.statusCode);
                            return;
                        }
                    }
                );
            });
        }
    );
}

function processDate(time) {
    let timeUnits = ['years', 'quarters', 'months', 'weeks', 'days', 'hours', 'minutes'];
    let processedDate = moment();
    let args = time.split(' ');

    if (args.length == 1) return;

    for (let i = 0 ; i < args.length - 1 ; i+=2){
        let number = args[i];
        if (isNaN(number)) return;
        if (number < 0) return;
        number = Number(number);

        let units = /[^s]*/.exec(args[i+1])[0] + 's';
        if (timeUnits.indexOf(units) > -1) {
            processedDate.add(number, units);
        } else {
            return;
        }
    }

    return processedDate.toDate();
}

function initStrawpoll(msg, question, options, endTime, isMulti) {
    request.post('https://strawpoll.me/api/v2/polls', 
        {
            json: true,
            followAllRedirects: true,
            body: {
                "title": question,
                "options": options,
                "multi": isMulti
            }
        }, function(error, response, body) {
            if (!error && response.statusCode == 200) {
                msg.channel.sendMessage('@here', {embed: {
                    color: 8190976,     // lawn green
                    title: 'POLL: ' + body.title,
                    description: 'http://strawpoll.me/' + body.id,
                    timestamp: new Date(),
                    footer: {
                        icon_url: msg.author.avatarURL,
                        text: 'Strawpoll created by ' + msg.author.username,
                    }
                }});
                var strawpoll = new Strawpoll({
                    pollId: body.id,
                    channelId: msg.channel.id,
                    authorId: msg.author.id,
                    time: endTime
                });
                strawpoll.save(function(err, reminder) {
                    if (err) {
                        console.log(`Error with saving strawpoll: ` + err);
                    } else {
                        console.log(`Strawpoll saved.`);
                    }
                });

            } else {
                msg.channel.sendMessage("There was an error in making your strawpoll. Sorry!");
                console.log('some sort of failure: ' + response.statusCode);
                return;
            }
        }
    );
}

function shuffleSongs() {
    for (let i = songs.length ; i ; i--) {
        let j = Math.floor(Math.random() * i);
        [songs[i - 1], songs[j]] = [songs[j], songs[i - 1]];
    }
}

function playNextSong(voiceChannel) {
    currentSongIndex = (currentSongIndex + 1) % songs.length;
    let file = songs[currentSongIndex].path;
    setStatus(songs[currentSongIndex].title + ' - ' + songs[currentSongIndex].artist);
    dispatcher = voiceConnection.playFile(file, { seek: 0, volume: 0.3 });
    dispatcher.on('end', () => {
        dispatcher = null;
        var numUserMembers = 0;
        console.log(voiceChannel.members.values());
        for (let member of voiceChannel.members.values()) {
            if (!member.user.bot) {
                console.log("USER IS NOT A BOT");
                numUserMembers++;
            } else {
                console.log("USER IS A BOT");
            }
        }
        console.log("TOTAL USER MEMBERS: " + numUserMembers);
        if (numUserMembers > 0 && !songInterrupt) {
            playNextSong(voiceChannel);
        } else if (numUserMembers > 0) {
            songInterrupt = false;
        } else {
            voiceChannel.leave();
            voiceChannel = null;
            voiceConnection = null;
            setStatus(botDefaultStatus);
        }
    });
}

bot.on("message", msg => {
    if (msg.author.bot) return;

    let args = msg.content.split(' ');
    let command = args.splice(0, 1).toString().toLowerCase();

    if (!(command in commands)) return;
    if (commands[command].expectedArgs != args.length && commands[command].expectedArgs != -1) return;
    if (commands[command].isAdminCommand && !auth.admins.includes(msg.author.id)) return;
    if (!commands[command].availableByDM && msg.channel.type === 'dm') return; 

    commands[command].run(msg, args);
});

bot.on("ready", () => {
    startTime = moment();
    console.log(`Ready to serve in ${bot.channels.size} channels on ${bot.guilds.size} servers, for a total of ${bot.users.size} users.`);
    setStatus(botDefaultStatus);
    shuffleSongs();
});

bot.login(auth.token).then(console.log('Logged in.')).catch(error => console.log(error));

setInterval(checkPeriodics, 60000);
