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
        .setDescription("Recria a estrutura de um servidor através de um arquivo JSON.")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const guild = interaction.guild;

            // =====================================================
            // LOCALIZAR O JSON
            // =====================================================

            const exportsPath = path.join(__dirname, "..", "exports");

            if (!fs.existsSync(exportsPath)) {
                return interaction.editReply(
                    "❌ A pasta `exports` não existe."
                );
            }

            const arquivos = fs.readdirSync(exportsPath)
                .filter(file => file.endsWith(".json"));

            if (!arquivos.length) {
                return interaction.editReply(
                    "❌ Nenhum arquivo JSON foi encontrado na pasta `exports`."
                );
            }

            // Pega o primeiro JSON encontrado
            const arquivo = path.join(exportsPath, arquivos[0]);

            const dados = JSON.parse(
                fs.readFileSync(arquivo, "utf8")
            );

            // =====================================================
            // AVISO
            // =====================================================

            console.log(
                `🏗️ Iniciando criação de: ${dados.nome}`
            );

            // =====================================================
            // MAPA DOS CARGOS
            //
            // antigo ID -> novo ID
            // =====================================================

            const roleMap = new Map();

            // @everyone do servidor original
            // será substituído pelo @everyone do novo servidor
            const oldGuildId = Object.keys(
                dados.canais
                    .flatMap(c => c.permissionOverwrites || [])
                    .reduce((acc, overwrite) => {
                        acc[overwrite.id] = true;
                        return acc;
                    }, {})
            ).find(id => id === dados.nome);

            // =====================================================
            // CRIAR CARGOS
            // =====================================================

            const rolesOrdenados = [...dados.cargos]
                .sort((a, b) => a.position - b.position);

            let cargosCriados = 0;

            for (const roleData of rolesOrdenados) {

                // Verifica se já existe cargo com o mesmo nome
                let role = guild.roles.cache.find(
                    r => r.name === roleData.name
                );

                if (!role) {

                    try {
                        role = await guild.roles.create({
                            name: roleData.name,
                            color: roleData.color,
                            hoist: roleData.hoist,
                            mentionable: roleData.mentionable,
                            permissions: roleData.permissions
                        });

                        cargosCriados++;

                        console.log(
                            `✅ Cargo criado: ${role.name}`
                        );

                    } catch (error) {

                        console.error(
                            `❌ Erro ao criar cargo ${roleData.name}:`,
                            error.message
                        );

                        continue;
                    }
                } else {

                    console.log(
                        `↪️ Cargo já existe: ${role.name}`
                    );
                }

                // MAPEAMENTO PRINCIPAL
                //
                // ID antigo -> ID novo
                roleMap.set(
                    `${roleData.position}:${roleData.name}`,
                    role.id
                );
            }

            // =====================================================
            // MAPA MAIS SEGURO:
            //
            // ID ANTIGO -> ID NOVO
            // =====================================================

            const oldIdToNewId = new Map();

            for (const roleData of dados.cargos) {

                const newRole = guild.roles.cache.find(
                    r => r.name === roleData.name
                );

                if (newRole) {
                    oldIdToNewId.set(
                        getOldRoleId(roleData, dados),
                        newRole.id
                    );
                }
            }

            // =====================================================
            // FUNÇÃO PARA ENCONTRAR O ID ANTIGO
            //
            // Como o exportador original não salva o ID dentro
            // de cada cargo, usamos os IDs presentes nos
            // permissionOverwrites para descobrir pelo nome.
            //
            // Para cargos sem overwrite, o ID antigo não pode
            // ser recuperado do JSON.
            // =====================================================

            function getOldRoleId(roleData, data) {

                const nome = roleData.name;

                // Procura IDs usados nos overwrites.
                for (const categoria of data.categorias || []) {

                    for (const overwrite of categoria.permissionOverwrites || []) {

                        const roleNoServidor = guild.roles.cache.find(
                            r => r.name === nome
                        );

                        if (roleNoServidor) {
                            return overwrite.id;
                        }
                    }
                }

                for (const canal of data.canais || []) {

                    for (const overwrite of canal.permissionOverwrites || []) {

                        const roleNoServidor = guild.roles.cache.find(
                            r => r.name === nome
                        );

                        if (roleNoServidor) {
                            return overwrite.id;
                        }
                    }
                }

                return `role:${nome}`;
            }

            // =====================================================
            // MAPEAR OVERWRITES
            // =====================================================

            function converterOverwrites(overwrites) {

                if (!Array.isArray(overwrites)) {
                    return [];
                }

                const resultado = [];

                for (const overwrite of overwrites) {

                    // ---------------------------------------------
                    // @everyone
                    // ---------------------------------------------

                    if (
                        overwrite.type === 0 &&
                        overwrite.id === guild.id
                    ) {
                        resultado.push({
                            id: guild.id,
                            allow: overwrite.allow || [],
                            deny: overwrite.deny || []
                        });

                        continue;
                    }

                    // ---------------------------------------------
                    // TENTAR MAPEAR CARGO PELO ID ANTIGO
                    // ---------------------------------------------

                    const novoId = oldIdToNewId.get(
                        overwrite.id
                    );

                    if (novoId) {

                        resultado.push({
                            id: novoId,
                            allow: overwrite.allow || [],
                            deny: overwrite.deny || []
                        });

                        continue;
                    }

                    // ---------------------------------------------
                    // ID NÃO MAPEADO
                    //
                    // Provavelmente usuário/bot do servidor original.
                    // Não copiamos.
                    // ---------------------------------------------

                    console.log(
                        `⚠️ Overwrite ignorado: ${overwrite.id}`
                    );
                }

                return resultado;
            }

            // =====================================================
            // CRIAR CATEGORIAS
            // =====================================================

            const categoryMap = new Map();

            const categoriasOrdenadas = [...dados.categorias]
                .sort((a, b) => a.position - b.position);

            let categoriasCriadas = 0;

            for (const categoriaData of categoriasOrdenadas) {

                let categoria = guild.channels.cache.find(
                    channel =>
                        channel.type === ChannelType.GuildCategory &&
                        channel.name === categoriaData.name
                );

                if (!categoria) {

                    try {

                        categoria = await guild.channels.create({
                            name: categoriaData.name,
                            type: ChannelType.GuildCategory,
                            permissionOverwrites:
                                converterOverwrites(
                                    categoriaData.permissionOverwrites
                                )
                        });

                        categoriasCriadas++;

                        console.log(
                            `📁 Categoria criada: ${categoria.name}`
                        );

                    } catch (error) {

                        console.error(
                            `❌ Erro na categoria ${categoriaData.name}:`,
                            error.message
                        );

                        continue;
                    }

                } else {

                    console.log(
                        `↪️ Categoria já existe: ${categoria.name}`
                    );
                }

                categoryMap.set(
                    categoriaData.name,
                    categoria.id
                );
            }

            // =====================================================
            // CRIAR CANAIS
            // =====================================================

            let canaisCriados = 0;

            const canaisOrdenados = [...dados.canais]
                .filter(channel => channel.type !== ChannelType.GuildCategory)
                .sort((a, b) => a.position - b.position);

            for (const canalData of canaisOrdenados) {

                // -------------------------------------------------
                // LOCALIZAR CATEGORIA
                // -------------------------------------------------

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

                // -------------------------------------------------
                // NÃO DUPLICAR
                // -------------------------------------------------

                const existente = guild.channels.cache.find(
                    channel =>
                        channel.name === canalData.name &&
                        channel.parentId === parentId &&
                        channel.type === canalData.type
                );

                if (existente) {

                    console.log(
                        `↪️ Canal já existe: ${canalData.name}`
                    );

                    continue;
                }

                // -------------------------------------------------
                // CONFIGURAÇÃO DO CANAL
                // -------------------------------------------------

                const options = {
                    name: canalData.name,
                    type: canalData.type,
                    parent: parentId,
                    permissionOverwrites:
                        converterOverwrites(
                            canalData.permissionOverwrites
                        )
                };

                // -------------------------------------------------
                // TEXTO
                // -------------------------------------------------

                if (canalData.type === ChannelType.GuildText) {

                    options.nsfw = canalData.nsfw || false;

                    if (canalData.topic) {
                        options.topic = canalData.topic;
                    }
                }

                // -------------------------------------------------
                // VOZ
                // -------------------------------------------------

                if (canalData.type === ChannelType.GuildVoice) {

                    if (canalData.bitrate) {
                        options.bitrate = canalData.bitrate;
                    }

                    if (canalData.userLimit !== null) {
                        options.userLimit =
                            canalData.userLimit;
                    }
                }

                // -------------------------------------------------
                // CRIAR
                // -------------------------------------------------

                try {

                    const canal =
                        await guild.channels.create(options);

                    canaisCriados++;

                    console.log(
                        `💬 Canal criado: ${canal.name}`
                    );

                } catch (error) {

                    console.error(
                        `❌ Erro ao criar canal ${canalData.name}:`,
                        error.message
                    );
                }
            }

            // =====================================================
            // TENTAR RESTAURAR HIERARQUIA DOS CARGOS
            // =====================================================

            const positions = [];

            for (const roleData of dados.cargos) {

                const role = guild.roles.cache.find(
                    r => r.name === roleData.name
                );

                if (!role) continue;

                positions.push({
                    role: role.id,
                    position: roleData.position
                });
            }

            if (positions.length) {

                try {

                    await guild.roles.setPositions(
                        positions.map(item => ({
                            role: item.role,
                            position: item.position
                        }))
                    );

                    console.log(
                        "✅ Hierarquia dos cargos restaurada."
                    );

                } catch (error) {

                    console.error(
                        "⚠️ Não foi possível restaurar toda a hierarquia:",
                        error.message
                    );
                }
            }

            // =====================================================
            // FINAL
            // =====================================================

            await interaction.editReply({
                content:
                    `✅ **Servidor recriado!**\n\n` +
                    `🏷️ Cargos criados: **${cargosCriados}**\n` +
                    `📁 Categorias criadas: **${categoriasCriadas}**\n` +
                    `💬 Canais criados: **${canaisCriados}**\n\n` +
                    `⚠️ Permissões de usuários/bots do servidor original ` +
                    `foram ignoradas porque os IDs não existem no novo servidor.`
            });

        } catch (error) {

            console.error(
                "❌ Erro geral ao criar servidor:",
                error
            );

            await interaction.editReply({
                content:
                    "❌ Ocorreu um erro ao recriar o servidor. " +
                    "Veja o console do bot para descobrir o problema."
            });
        }
    }
};

