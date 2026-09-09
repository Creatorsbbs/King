const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType
} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("criarservidor")
        .setDescription("Copia cargos, categorias e canais do servidor modelo.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const servidorModeloId = "1545134645719597099";
            const servidorDestino = interaction.guild;

            // ==========================================
            // PEGAR SERVIDOR MODELO
            // ==========================================

            const servidorModelo =
                await interaction.client.guilds.fetch(servidorModeloId);

            if (!servidorModelo) {
                return interaction.editReply(
                    "❌ Não consegui encontrar o servidor modelo."
                );
            }

            // Buscar dados completos
            await servidorModelo.channels.fetch();
            await servidorModelo.roles.fetch();

            console.log(
                `📦 Copiando estrutura de: ${servidorModelo.name}`
            );

            // ==========================================
            // MAPA ID ANTIGO -> ID NOVO
            // ==========================================

            const roleMap = new Map();

            // ==========================================
            // CRIAR CARGOS
            // ==========================================

            let cargosCriados = 0;

            const cargos = [...servidorModelo.roles.cache.values()]
                .filter(role => role.id !== servidorModelo.id)
                .sort((a, b) => a.position - b.position);

            for (const cargoOriginal of cargos) {

                // Se já existir um cargo com o mesmo nome,
                // usa o cargo existente.
                let cargoNovo =
                    servidorDestino.roles.cache.find(
                        role => role.name === cargoOriginal.name
                    );

                if (!cargoNovo) {
                    try {
                        cargoNovo =
                            await servidorDestino.roles.create({
                                name: cargoOriginal.name,
                                color: cargoOriginal.color,
                                hoist: cargoOriginal.hoist,
                                mentionable: cargoOriginal.mentionable,

                                // Permissões DO CARGO são copiadas.
                                permissions: cargoOriginal.permissions
                            });

                        cargosCriados++;

                        console.log(
                            `✅ Cargo criado: ${cargoNovo.name}`
                        );

                    } catch (error) {
                        console.log(
                            `❌ Erro ao criar cargo ${cargoOriginal.name}:`,
                            error.message
                        );

                        continue;
                    }
                }

                // Mapeia:
                // ID antigo -> ID novo
                roleMap.set(
                    cargoOriginal.id,
                    cargoNovo.id
                );
            }

            // ==========================================
            // RESTAURAR HIERARQUIA DOS CARGOS
            // ==========================================

            const positions = [];

            for (const cargoOriginal of cargos) {

                const novoId =
                    roleMap.get(cargoOriginal.id);

                if (!novoId) continue;

                positions.push({
                    role: novoId,
                    position: cargoOriginal.position
                });
            }

            if (positions.length) {
                try {
                    await servidorDestino.roles.setPositions(
                        positions
                    );

                    console.log(
                        "✅ Hierarquia dos cargos restaurada."
                    );

                } catch (error) {
                    console.log(
                        "⚠️ Não consegui restaurar a hierarquia:",
                        error.message
                    );
                }
            }

            // ==========================================
            // MAPA DE CATEGORIAS
            // ==========================================

            const categoryMap = new Map();

            let categoriasCriadas = 0;

            const categorias =
                [...servidorModelo.channels.cache.values()]
                    .filter(
                        channel =>
                            channel.type === ChannelType.GuildCategory
                    )
                    .sort((a, b) => a.position - b.position);

            // ==========================================
            // CRIAR CATEGORIAS
            // ==========================================

            for (const categoriaOriginal of categorias) {

                let categoriaNova =
                    servidorDestino.channels.cache.find(
                        channel =>
                            channel.type === ChannelType.GuildCategory &&
                            channel.name === categoriaOriginal.name
                    );

                if (!categoriaNova) {
                    try {

                        categoriaNova =
                            await servidorDestino.channels.create({
                                name: categoriaOriginal.name,
                                type: ChannelType.GuildCategory

                                // NÃO COPIA PERMISSÕES
                            });

                        categoriasCriadas++;

                        console.log(
                            `📁 Categoria criada: ${categoriaNova.name}`
                        );

                    } catch (error) {

                        console.log(
                            `❌ Erro na categoria ${categoriaOriginal.name}:`,
                            error.message
                        );

                        continue;
                    }
                }

                categoryMap.set(
                    categoriaOriginal.id,
                    categoriaNova.id
                );
            }

            // ==========================================
            // CRIAR CANAIS
            // ==========================================

            let canaisCriados = 0;

            const canais =
                [...servidorModelo.channels.cache.values()]
                    .filter(
                        channel =>
                            channel.type !== ChannelType.GuildCategory
                    )
                    .sort((a, b) => a.position - b.position);

            for (const canalOriginal of canais) {

                // ======================================
                // ENCONTRAR CATEGORIA
                // ======================================

                let parentId = null;

                if (canalOriginal.parentId) {
                    parentId =
                        categoryMap.get(
                            canalOriginal.parentId
                        ) || null;
                }

                // ======================================
                // VERIFICAR SE JÁ EXISTE
                // ======================================

                const canalExistente =
                    servidorDestino.channels.cache.find(
                        channel =>
                            channel.name === canalOriginal.name &&
                            channel.type === canalOriginal.type &&
                            channel.parentId === parentId
                    );

                if (canalExistente) {

                    console.log(
                        `↪️ Canal já existe: ${canalOriginal.name}`
                    );

                    continue;
                }

                // ======================================
                // CONFIGURAÇÃO DO CANAL
                // ======================================

                const options = {
                    name: canalOriginal.name,
                    type: canalOriginal.type,
                    parent: parentId

                    // IMPORTANTE:
                    // Nenhum permissionOverwrites.
                    // As permissões antigas NÃO serão copiadas.
                };

                // ======================================
                // TEXTO
                // ======================================

                if (
                    canalOriginal.type ===
                    ChannelType.GuildText
                ) {

                    options.nsfw =
                        canalOriginal.nsfw;

                    if (canalOriginal.topic) {
                        options.topic =
                            canalOriginal.topic;
                    }

                    if (canalOriginal.rateLimitPerUser) {
                        options.rateLimitPerUser =
                            canalOriginal.rateLimitPerUser;
                    }
                }

                // ======================================
                // VOZ
                // ======================================

                if (
                    canalOriginal.type ===
                    ChannelType.GuildVoice
                ) {

                    options.bitrate =
                        canalOriginal.bitrate;

                    options.userLimit =
                        canalOriginal.userLimit;
                }

                // ======================================
                // FÓRUM
                // ======================================

                if (
                    canalOriginal.type ===
                    ChannelType.GuildForum
                ) {

                    options.topic =
                        canalOriginal.topic || undefined;

                    options.rateLimitPerUser =
                        canalOriginal.rateLimitPerUser || 0;
                }

                // ======================================
                // CRIAR CANAL
                // ======================================

                try {

                    const canalNovo =
                        await servidorDestino.channels.create(
                            options
                        );

                    canaisCriados++;

                    console.log(
                        `💬 Canal criado: ${canalNovo.name}`
                    );

                } catch (error) {

                    console.log(
                        `❌ Erro no canal ${canalOriginal.name}:`,
                        error.message
                    );
                }
            }

            // ==========================================
            // FINAL
            // ==========================================

            await interaction.editReply({
                content:
                    `✅ **Servidor copiado com sucesso!**\n\n` +
                    `📦 Modelo: **${servidorModelo.name}**\n\n` +
                    `🏷️ Cargos criados: **${cargosCriados}**\n` +
                    `📁 Categorias criadas: **${categoriasCriadas}**\n` +
                    `💬 Canais criados: **${canaisCriados}**\n\n` +
                    `🔄 IDs dos cargos foram mapeados automaticamente.\n` +
                    `🔒 Permissões dos canais/categorias **não foram copiadas**.`
            });

        } catch (error) {

            console.error(
                "❌ Erro ao copiar servidor:",
                error
            );

            await interaction.editReply({
                content:
                    `❌ **Erro ao copiar o servidor.**\n\n` +
                    `\`${error.message}\``
            });
        }
    }
};
