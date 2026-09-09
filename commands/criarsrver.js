const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType
} = require("discord.js");

const fs = require("fs");
const path = require("path");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("criarservidor")
        .setDescription("Cria os cargos, categorias e canais do servidor.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const guild = interaction.guild;

            // ==========================================
            // LOCALIZAR O JSON
            // ==========================================

            const jsonPath = path.join(
                __dirname,
                "..",
                "servidor-1545134645719597099.json"
            );

            if (!fs.existsSync(jsonPath)) {
                return interaction.editReply(
                    "❌ Não encontrei o arquivo `servidor-1545134645719597099.json` na pasta principal do bot."
                );
            }

            const dados = JSON.parse(
                fs.readFileSync(jsonPath, "utf8")
            );

            // ==========================================
            // MAPA DE CARGOS
            // ==========================================

            const roleMap = new Map();

            let cargosCriados = 0;

            // ==========================================
            // CRIAR CARGOS
            // ==========================================

            const cargos = [...(dados.cargos || [])]
                .sort((a, b) => a.position - b.position);

            for (const cargoData of cargos) {

                // Não tenta criar o @everyone
                if (cargoData.name === "@everyone") {
                    continue;
                }

                let cargo = guild.roles.cache.find(
                    role => role.name === cargoData.name
                );

                if (!cargo) {

                    try {

                        cargo = await guild.roles.create({
                            name: cargoData.name,
                            color: cargoData.color || "Default",
                            hoist: cargoData.hoist || false,
                            mentionable: cargoData.mentionable || false,

                            // Mantém as permissões DO CARGO
                            // porque você pediu os cargos.
                            permissions: cargoData.permissions || []
                        });

                        cargosCriados++;

                        console.log(
                            `✅ Cargo criado: ${cargo.name}`
                        );

                    } catch (error) {

                        console.log(
                            `❌ Não foi possível criar o cargo ${cargoData.name}:`,
                            error.message
                        );

                        continue;
                    }
                }

                // ID do cargo novo
                roleMap.set(
                    cargoData.name,
                    cargo.id
                );
            }

            // ==========================================
            // RESTAURAR HIERARQUIA DOS CARGOS
            // ==========================================

            const positions = [];

            for (const cargoData of cargos) {

                const cargo = guild.roles.cache.find(
                    role => role.name === cargoData.name
                );

                if (!cargo) continue;

                positions.push({
                    role: cargo.id,
                    position: cargoData.position
                });
            }

            if (positions.length) {

                try {

                    await guild.roles.setPositions(
                        positions
                    );

                    console.log(
                        "✅ Hierarquia dos cargos restaurada."
                    );

                } catch (error) {

                    console.log(
                        "⚠️ Erro ao restaurar hierarquia:",
                        error.message
                    );
                }
            }

            // ==========================================
            // CRIAR CATEGORIAS
            // ==========================================

            const categoryMap = new Map();

            let categoriasCriadas = 0;

            const categorias = [...(dados.categorias || [])]
                .sort((a, b) => a.position - b.position);

            for (const categoriaData of categorias) {

                let categoria = guild.channels.cache.find(
                    channel =>
                        channel.type === ChannelType.GuildCategory &&
                        channel.name === categoriaData.name
                );

                if (!categoria) {

                    try {

                        // IMPORTANTE:
                        // NÃO colocamos permissionOverwrites.
                        // Portanto nenhuma permissão antiga
                        // dos canais/categorias será copiada.

                        categoria = await guild.channels.create({
                            name: categoriaData.name,
                            type: ChannelType.GuildCategory
                        });

                        categoriasCriadas++;

                        console.log(
                            `📁 Categoria criada: ${categoria.name}`
                        );

                    } catch (error) {

                        console.log(
                            `❌ Erro na categoria ${categoriaData.name}:`,
                            error.message
                        );

                        continue;
                    }
                }

                categoryMap.set(
                    categoriaData.name,
                    categoria.id
                );
            }

            // ==========================================
            // CRIAR CANAIS
            // ==========================================

            let canaisCriados = 0;

            const canais = [...(dados.canais || [])]
                .filter(channel =>
                    channel.type !== ChannelType.GuildCategory
                )
                .sort((a, b) => a.position - b.position);

            for (const canalData of canais) {

                // ======================================
                // ENCONTRAR CATEGORIA
                // ======================================

                let parentId = null;

                if (canalData.parent) {

                    parentId = categoryMap.get(
                        canalData.parent
                    );

                    if (!parentId) {

                        const categoriaExistente =
                            guild.channels.cache.find(
                                channel =>
                                    channel.type === ChannelType.GuildCategory &&
                                    channel.name === canalData.parent
                            );

                        if (categoriaExistente) {
                            parentId = categoriaExistente.id;
                        }
                    }
                }

                // ======================================
                // VERIFICAR SE JÁ EXISTE
                // ======================================

                const existente =
                    guild.channels.cache.find(
                        channel =>
                            channel.name === canalData.name &&
                            channel.type === canalData.type &&
                            channel.parentId === parentId
                    );

                if (existente) {

                    console.log(
                        `↪️ Canal já existe: ${canalData.name}`
                    );

                    continue;
                }

                // ======================================
                // CONFIGURAÇÃO
                // ======================================

                const options = {
                    name: canalData.name,
                    type: canalData.type,
                    parent: parentId
                };

                // ======================================
                // CANAL DE TEXTO
                // ======================================

                if (
                    canalData.type === ChannelType.GuildText
                ) {

                    options.nsfw =
                        canalData.nsfw || false;

                    if (canalData.topic) {
                        options.topic =
                            canalData.topic;
                    }
                }

                // ======================================
                // CANAL DE VOZ
                // ======================================

                if (
                    canalData.type === ChannelType.GuildVoice
                ) {

                    if (canalData.bitrate) {
                        options.bitrate =
                            canalData.bitrate;
                    }

                    if (
                        canalData.userLimit !== null &&
                        canalData.userLimit !== undefined
                    ) {
                        options.userLimit =
                            canalData.userLimit;
                    }
                }

                // ======================================
                // CRIAR
                // ======================================

                try {

                    const canal =
                        await guild.channels.create(
                            options
                        );

                    canaisCriados++;

                    console.log(
                        `💬 Canal criado: ${canal.name}`
                    );

                } catch (error) {

                    console.log(
                        `❌ Erro no canal ${canalData.name}:`,
                        error.message
                    );
                }
            }

            // ==========================================
            // FINAL
            // ==========================================

            await interaction.editReply({
                content:
                    `✅ **Estrutura criada com sucesso!**\n\n` +
                    `🏷️ Cargos: **${cargosCriados}**\n` +
                    `📁 Categorias: **${categoriasCriadas}**\n` +
                    `💬 Canais: **${canaisCriados}**\n\n` +
                    `🔒 **Permissões dos canais/categorias NÃO foram copiadas.**`
            });

        } catch (error) {

            console.error(
                "❌ Erro ao criar servidor:",
                error
            );

            await interaction.editReply({
                content:
                    "❌ Deu erro ao criar a estrutura. Veja o console do bot."
            });
        }
    }
};
