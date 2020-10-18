const Discord = require("discord.js");
const db = require("quick.db");
const config = require("./config.json");

// declare the client
const client = new Discord.Client();

// do something when the bot is logged in
client.on("ready", () => {
  console.log(`Successfully logged in as ${client.user.tag}.`)
})

client.on("message", async message => {
  if(message.channel.type === "dm"){
    if(message.author.bot) return;
    if(message.content.includes("@everyone") || message.content.includes("@here")) return message.author.send("You can't use everyone/here mentions.")
    var table = new db.table("Tickets");
    let active = await table.get(`support_${message.author.id}`)
    let guild = client.guilds.cache.get(config.guild);
    let channel, found = true;
    let user = await table.get(`isBlocked${message.author.id}`);
    if(user === true || user === "true") return message.react("❌");
    try {
      if(active) client.channels.cache.get(active.channelID).guild;
    } catch (e) {
      found = false;
    }
    if(!active || !found){
      active = {};
      let modrole = guild.roles.cache.get(config.roles.mod);
      let everyone = guild.roles.cache.get(guild.roles.everyone.id);
      let bot = guild.roles.cache.get(config.roles.bot);
      await table.add("ticket", 1)
      let actualticket = await table.get("ticket");
      channel = await guild.channels.create(`${message.author.username}-${message.author.discriminator}`, { type: 'text', reason: `Modmail created ticket #${actualticket}.` });
      channel.setParent("571299988471152690");
      channel.setTopic(`#${actualticket} (Open) | ${config.prefix}complete to close this ticket | Modmail for ${message.author.username} - ${message.author.id}`)
      channel.createOverwrite(modrole, {
        VIEW_CHANNEL: true,
        SEND_MESSAGES: true,
        READ_MESSAGE_HISTORY: true
      });
      channel.createOverwrite(everyone, {
        VIEW_CHANNEL: false
      });
      channel.createOverwrite(bot, {
        VIEW_CHANNEL: true,
        SEND_MESSAGES: true,
        READ_MESSAGE_HISTORY: true,
        MANAGE_MESSAGES: true
      })
      let author = message.author;
      const newChannel = new Discord.MessageEmbed()
        .setColor("BLUE").setAuthor(author.tag, author.avatarURL())
        .setDescription(`Ticket #${actualticket} created.\nUser: ${author}\nID: ${author.id}`)
        .setTimestamp()
      await client.channels.cache.get(channel.id).send({embed:newChannel});
      message.author.send(`Hello ${author.username}, your ticket #${actualticket} has been created.`)
      active.channelID = channel.id;
      active.targetID = author.id;
    }
    channel = client.channels.cache.get(active.channelID);
    await message.author.send()
    var msg = message.content;
    //var whatWeWant = msg.replace("@everyone", "[everyone]").replace("@here", `[here]`) // idk if that's useful since we're blocking mentions
    if(message.attachments.size > 0){
      let attachment = new Discord.MessageAttachment(message.attachments.first().url)
      channel.send(`${message.author.username} > ${whatWeWant}`, {files: [message.attachments.first().url]})
    } else {
      channel.send(`${message.author.username} > ${whatWeWant}`);
    }
    table.set(`support_${message.author.id}`, active);
    table.set(`supportChannel_${channel.id}`, message.author.id);
    return;
  }
  if(message.author.bot) return;
  var table = new db.table("Tickets");
  let support = await table.get(`supportChannel_${message.channel.id}`);
  if(support){
    support = await table.get(`support_${support}`);
    var user = new db.table(`Language`);
    let lang = await user.get(`U${support.targetID}`);
    let supportUser = client.users.cache.get(support.targetID);
    if(!supportUser) return message.channel.delete();
    
    // reply (with user and role)
    if(message.content.startsWith(`${config.prefix}reply`)){
      var isPause = await table.get(`suspended${support.targetID}`);
      let isBlock = await table.get(`isBlocked${support.targetID}`);
      if(isPause === true) return message.channel.send("Ticket already paused.")
      if(isBlock === true) return message.channel.send("User blocked.")
      var args = message.content.split(" ").slice(1)
      let msg = args.join(" ");
      message.react("✅");
      if(message.attachments.size > 0){
        let attachment = new Discord.MessageAttachment(message.attachments.first().url)
        return supportUser.send(`${message.author.username} > ${msg}`, {files: [message.attachments.first().url]})
      } else {
        return supportUser.send(`${message.author.username} > ${msg}`);
      }
    };
    
    // anonymous reply
    if(message.content.startsWith(`${config.prefix}areply`)){
      var isPause = await table.get(`suspended${support.targetID}`);
      let isBlock = await table.get(`isBlocked${support.targetID}`);
      if(isPause === true) return message.channel.send("Ticket already paused.")
      if(isBlock === true) return message.channel.send("User blocked.")
      var args = message.content.split(" ").slice(1)
      let msg = args.join(" ");
      message.react("✅");
      return supportUser.send(`Support Team > ${msg}`);
    };
    
    // print user ID
    if(message.content === `${config.prefix}id`){
      return message.channel.send(`User ID is **${support.targetID}**.`);
    };
    
    // suspend a thread
    if(message.content === `${config.prefix}pause`){
      var isPause = await table.get(`suspended${support.targetID}`);
      if(isPause === true || isPause === "true") return message.channel.send("Ticket already paused.")
      await table.set(`suspended${support.targetID}`, true);
      var suspend = new Discord.MessageEmbed()
      .setDescription(`⏸️ This thread has been **locked** and **suspended**. Do \`${config.prefix}continue\` to cancel.`)
      .setTimestamp()
      .setColor("YELLOW")
      message.channel.send({embed: suspend});
      return supportUser.send("Your ticket has been paused. We'll send you a message when we're ready to continue.")
    };
    
    // continue a thread
    if(message.content === `${config.prefix}continue`){
      var isPause = await table.get(`suspended${support.targetID}`);
      if(isPause === null || isPause === false) return message.channel.send("Ticket wasn't paused.");
      await table.delete(`suspended${support.targetID}`);
      var c = new Discord.MessageEmbed()
      .setDescription("▶️ This thread has been **unlocked**.")
      .setColor("BLUE").setTimestamp()
      message.channel.send({embed: c});
      return supportUser.send("Hi! Your ticket isn't paused anymore and we're ready to continue.");
    }
    
    // block a user
    if(message.content.startsWith(`${config.prefix}block`)){
      var args = message.content.split(" ").slice(1)
      let isBlock = await table.get(`isBlocked${support.targetID}`);
      if(isBlock === true) return message.channel.send("User is already blocked")
      await table.set(`isBlocked${support.targetID}`, true);
      return message.channel.send(`<:tick1:588568490496098307> This user has been blocked from using the modmail. Close the ticket with \`${config.prefix}complete\`.`)
    }
    
    // unblock a user
    if(message.content.startsWith(`${config.prefix}unblock`)){
      let isBlock = await table.get(`isBlocked${support.targetID}`);
      if(isBlock === false || !isBlock || isBlock === null) return message.channel.send("User wasn't blocked")
      var args = message.content.split(" ").slice(1)
      await table.delete(`isBlocked${support.targetID}`);
      return message.channel.send(`<:tick1:588568490496098307> This user has been unblocked from using the modmail.`)
    }
    
    // complete
    if(message.content.toLowerCase() === `${config.prefix}complete`){
        var embed = new Discord.MessageEmbed()
        .setDescription(`Deleting this thread in **10** seconds...\n:lock: This thread has been locked and closed.`)
        .setColor("YELLOW").setTimestamp()
        message.channel.send({embed: embed})
        var timeout = 10000
        setTimeout(() => {end();}, timeout)
      }
      async function end(){
        table.delete(`support_${support.targetID}`)
        let actualticket = await table.get("ticket");
        message.channel.delete()
        return supportUser.send(`Your ticket #${actualticket} has been closed! Thanks for contacting us. If you wish to open a new ticket, feel free to message me.`)
      }
    };
  }
})

client.login(process.env.TOKEN); // Log the bot in
