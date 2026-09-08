
const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

const fs = require("fs");
const path = require("path");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("exportarservidor")
        .setDescription("Exporta a estrutura completa do servidor.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const guild = interaction.guild;

            // =========================
            // CARGOS
            // =========================
            const roles = guild.roles.cache
                .sort((a, b) => b.position - a.position)
                .filter(role => role.id !== guild.id)
                .map(role => ({
                    name: role.name,
                    color: role.hexColor,
                    hoist: role.hoist,
                    mentionable: role.mentionable,
                    permissions: role.permissions.toArray(),
                    position: role.position
                }));

            // =========================
            // CANAIS
            // =========================
            const channels = guild.channels.cache
                .sort((a, b) => {
                    if (a.parentId !== b.parentId) return 0;
                    return a.rawPosition - b.rawPosition;
                })
                .map(channel => ({
                    name: channel.name,
                    type: channel.type,
                    parent: channel.parent ? channel.parent.name : null,
                    position: channel.rawPosition,
                    nsfw: channel.nsfw ?? false,
                    topic: channel.topic ?? null,
                    bitrate: channel.bitrate ?? null,
                    userLimit: channel.userLimit ?? null,

                    permissionOverwrites:
                        channel.permissionOverwrites?.cache.map(overwrite => ({
                            id: overwrite.id,
                            type: overwrite.type,
                            allow: overwrite.allow.toArray(),
                            deny: overwrite.deny.toArray()
                        })) || []
                }));

            // =========================
            // CATEGORIAS
            // =========================
            const categories = guild.channels.cache
                .filter(channel => channel.type === 4)
                .sort((a, b) => a.rawPosition - b.rawPosition)
                .map(category => ({
                    name: category.name,
                    position: category.rawPosition,

                    permissionOverwrites:
                        category.permissionOverwrites?.cache.map(overwrite => ({
                            id: overwrite.id,
                            type: overwrite.type,
                            allow: overwrite.allow.toArray(),
                            deny: overwrite.deny.toArray()
                        })) || []
                }));

            // =========================
            // INFORMAÇÕES DO SERVIDOR
            // =========================
            const servidor = {
                nome: guild.name,

                icone: guild.iconURL({
                    extension: "png",
                    size: 1024
                }),

                cargos: roles,
                categorias: categories,
                canais: channels
            };

            // =========================
            // CRIAR ARQUIVO
            // =========================
            const pasta = path.join(__dirname, "..", "exports");

            if (!fs.existsSync(pasta)) {
                fs.mkdirSync(pasta, { recursive: true });
            }

            const arquivo = path.join(
                pasta,
                `servidor-${guild.id}.json`
            );

            fs.writeFileSync(
                arquivo,
                JSON.stringify(servidor, null, 4),
                "utf8"
            );

            // =========================
            // ENVIAR ARQUIVO
            // =========================
            await interaction.editReply({
                content:
                    `✅ **Servidor exportado com sucesso!**\n\n` +
                    `📁 Cargos: **${roles.size}**\n` +
                    `📁 Categorias: **${categories.length}**\n` +
                    `💬 Canais: **${channels.length}**\n\n` +
                    `O arquivo abaixo contém a estrutura do servidor.`,
                files: [arquivo]
            });

        } catch (error) {
            console.error("Erro ao exportar servidor:", error);

            await interaction.editReply({
                content:
                    "❌ Ocorreu um erro ao exportar o servidor. " +
                    "Verifique o console do bot."
            });
        }
    }
};
