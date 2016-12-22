var Discord = require("discord.js");
var bot = new Discord.Client();

const botToken = 'MjQ2NDU0NTE3Njc4MjExMDcz.Cxffvw.V_O7T7Z_xfB3rETusRs31T7lW34';

var messageCurrentlyTyping = "";
var isTyping = false;

bot.on("message", msg => {
  if (msg.author.bot) return;

  if (isTyping) return;

  if (msg.author.id === '89915430898012160') {
    adminCommands(msg);
  }

  if (msg.author.username === 'Becca'){
    simulateTyping(msg.channel, "*hugs*");
  }

});

bot.on("typingStart", (channel, user) => {
  if (user.id === bot.user.id) {
    isTyping = true;
  }
});

bot.on("typingStop", (channel, user) => {
  if (user.id === bot.user.id) {
    channel.sendMessage(messageCurrentlyTyping);
    isTyping = false;
  }
});

function changeUsername(text){
  bot.user.setUsername(text)
    .then(user => console.log(`My new username is ${user.username}`))
    .catch(console.log('Your username change is probably on cooldown.'));
}

function changeAvatar(path){
  bot.user.setAvatar(path)
    .then(user => console.log(`New avatar set!`))
    .catch(console.error);;
}

function simulateTyping(channel, msg){
  messageCurrentlyTyping = msg;
  channel.startTyping();
  channel.stopTyping();
}

function adminCommands(msg){
  if (msg.content.startsWith('!username')){
    if (msg.content.split(' ').length == 1){
      return;
    } else {
      let newUsername = msg.content.slice(10);
      changeUsername(newUsername);
    }
  }
}

bot.on("ready", () => {
  console.log(`Ready to serve in ${bot.channels.size} channels on ${bot.guilds.size} servers, for a total of ${bot.users.size} users.`);
});

bot.login("MjQ2NDU0NTE3Njc4MjExMDcz.Cxk8hg.XUIdUaOwYaMBCan8byKuApR0WNA");
