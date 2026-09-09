const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("darcargo")
        .setDescription("Adiciona um cargo a todos os membros do servidor, exceto bots.")
        .addRoleOption(option =>
            option
                .setName("cargo")
                .setDescription("Cargo que será dado aos membros.")
                .setRequired(true)
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.Administrator
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const guild = interaction.guild;
            const cargo = interaction.options.getRole("cargo");

            // Verifica se o bot consegue gerenciar o cargo
            if (cargo.position >= guild.members.me.roles.highest.position) {
                return interaction.editReply(
                    "❌ Não consigo adicionar esse cargo porque ele está acima ou no mesmo nível do meu cargo."
                );
            }

            // Busca todos os membros do servidor
            const membros = await guild.members.fetch();

            // Remove os bots
            const membrosHumanos = membros.filter(
                membro => !membro.user.bot
            );

            let adicionados = 0;
            let jaPossuiam = 0;
            let erros = 0;

            for (const membro of membrosHumanos.values()) {

                if (membro.roles.cache.has(cargo.id)) {
                    jaPossuiam++;
                    continue;
                }

                try {
                    await membro.roles.add(cargo);
                    adicionados++;

                    console.log(
                        `✅ Cargo ${cargo.name} dado para ${membro.user.tag}`
                    );

                } catch (error) {
                    erros++;

                    console.log(
                        `❌ Erro ao dar cargo para ${membro.user.tag}:`,
                        error.message
                    );
                }
            }

            await interaction.editReply({
                content:
                    `✅ **Cargo distribuído!**\n\n` +
                    `🏷️ Cargo: ${cargo}\n` +
                    `👥 Membros encontrados: **${membrosHumanos.size}**\n` +
                    `✅ Adicionados: **${adicionados}**\n` +
                    `↪️ Já possuíam: **${jaPossuiam}**\n` +
                    `❌ Erros: **${erros}**\n\n` +
                    `🤖 Bots foram ignorados.`
            });

        } catch (error) {

            console.error(
                "❌ Erro no comando /darcargo:",
                error
            );

            await interaction.editReply(
                "❌ Ocorreu um erro ao distribuir o cargo."
            );
        }
    }
};
