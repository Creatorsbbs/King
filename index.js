const {
    Client,
    GatewayIntentBits,
    Collection,
    Events,
    REST,
    Routes
} = require("discord.js");

const fs = require("fs");
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");

const app = express();

app.get("/", (req, res) => {
    res.send("Bot online!");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor iniciado na porta ${PORT}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();

const commands = [];

const commandsPath = path.join(__dirname, "commands");

const commandFiles = fs
    .readdirSync(commandsPath)
    .filter(file => file.endsWith(".js"));

for (const file of commandFiles) {

    const command = require(path.join(commandsPath, file));

    client.commands.set(command.data.name, command);

    commands.push(command.data.toJSON());

}

const eventsPath = path.join(__dirname, "events");

const eventFiles = fs
    .readdirSync(eventsPath)
    .filter(file => file.endsWith(".js"));

for (const file of eventFiles) {

    const event = require(path.join(eventsPath, file));

    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }

}

client.once(Events.ClientReady, async readyClient => {

    console.log(`${readyClient.user.tag} está online!`);

    try {

        const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID
            ),
            {
                body: commands
            }
        );

        console.log("✅ Slash Commands registrados!");

    } catch (err) {

        console.error("Erro ao registrar os Slash:", err);

    }

});

client.on(Events.InteractionCreate, async interaction => {

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {

        await command.execute(interaction);

    } catch (error) {

        console.error(error);

        if (interaction.replied || interaction.deferred) {

            await interaction.followUp({
                content: "❌ Ocorreu um erro ao executar este comando.",
                ephemeral: true
            });

        } else {

            await interaction.reply({
                content: "❌ Ocorreu um erro ao executar este comando.",
                ephemeral: true
            });

        }

    }

});

mongoose.connect(process.env.MONGO_URI)
.then(() => {
    console.log("✅ MongoDB conectado!");
})
.catch((err) => {
    console.error("❌ Erro ao conectar ao MongoDB:", err);
});

client.login(process.env.TOKEN);
