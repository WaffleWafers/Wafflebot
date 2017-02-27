var auth = require('./auth.json');
const Discord = require("discord.js");
const moment = require('moment');
const mongoose = require('mongoose');
const async = require('async');
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

var Reminder = mongoose.model('Reminder', reminderSchema);

const commands = {
    '!help': {
        description: `Show list of all commands.`,
        isAdminCommand: false,
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
        expectedArgs: -1,
        run: function(msg, args) {
            if (args.length == 0) return;
            let username = args.join(' ');
            changeUsername(username);
        }
    },
    '!remindme': {
        description: `Reminds you with a PM.`,
        argDescription: `<int> <unit> <"message">`,
        isAdminCommand: false,
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
        expectedArgs: 0,
        run: function(msg, args) {
            sendReminders();
        }
    },
    '!purge': {
        description: `Deletes the past N messages sent.`,
        argDescription: `<int>`,
        isAdminCommand: false,
        expectedArgs: 1,
        run: function(msg, args) {
            if (!msg.guild.member(msg.author).hasPermission("MANAGE_MESSAGES")) return;
            let numMessages = args[0];
            let originalMessageId = msg.id;
            if (isNaN(numMessages)) return;
            if (numMessages < 0 || numMessages > 50) return;
            let channel = msg.channel;
            channel.fetchMessages({limit: numMessages, before: originalMessageId}).then(
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
                        console.log('Error fetching messages to purge: ' + reason);
                    }
                );
            console.log('Successfully deleted messages.');
        }
    },
    '!test': {
        description: `test`,
        isAdminCommand: true,
        expectedArgs: 0,
        run: function(msg, args) {
            let user = msg.author;
            let guild = msg.guild;
            console.log(guild.member(user).hasPermission("MANAGE_MESSAGES"));
        }
    }
};

bot.on("message", msg => {
    if (msg.author.bot) return;

    let args = msg.content.split(' ');
    let command = args.splice(0, 1).toString().toLowerCase();

    if (!(command in commands)) return;
    if (commands[command].expectedArgs != args.length && commands[command].expectedArgs != -1) return;
    if (commands[command].isAdminCommand == true && !auth.admins.includes(msg.author.id)) return;

    commands[command].run(msg, args);
});

function changeUsername(text){
    bot.user.setUsername(text)
        .then(user => console.log(`My new username is ${user.username}`))
        .catch(console.log('Your username change is probably on cooldown.'));
}

function changeAvatar(path){
    bot.user.setAvatar(path)
        .then(user => console.log(`New avatar set!`))
        .catch(console.error);
}

var sendReminders = function() {
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
                    color: 3447003,
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

function processDate(time) {
    let timeUnits = ['years', 'quarters', 'months', 'weeks', 'days', 'hours', 'minutes'];
    let processedDate = moment();
    let args = time.split(' ');

    if (args.length == 1) return;

    for (let i = 0 ; i < args.length - 1 ; i+=2){
        console.log(args[i] + " " + /[^s]*/.exec(args[i+1])[0] + 's');
        let number = args[i];
        if (isNaN(number)) return;
        if (number < 0) return;
        number = Number(number);

        let units = /[^s]*/.exec(args[i+1])[0] + 's';
        if (timeUnits.indexOf(units) > -1) {
            processedDate.add(number, units);
        }
    }

    console.log(processedDate.format());
    return processedDate.toDate();
}


bot.on("ready", () => {
    console.log(`Ready to serve in ${bot.channels.size} channels on ${bot.guilds.size} servers, for a total of ${bot.users.size} users.`);
});

bot.login(auth.token).then(console.log('Logged in.')).catch(error => console.log(error));

setInterval(sendReminders, 60000);
