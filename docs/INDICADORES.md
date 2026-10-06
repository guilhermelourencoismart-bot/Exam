# Indicadores e denominadores

O código está em `src/domain/analytics.ts`; a classificação comum está em `src/domain/classification.ts`. A correção sempre usa o snapshot do gabarito conferido para a versão da questão, nunca uma letra transferida de outro caderno.

## Base da análise

Só entram tentativas com `status=completed` e data de finalização. Cada ocorrência avaliável tem questão, resposta (ou branco), chave comprovada, origem e classificação. Provas em andamento e configurações salvas não contam como provas finalizadas. Os filtros de período usam a finalização no fuso `America/Sao_Paulo`.

- Percentual: `100 × acertos / questões avaliáveis`. Questões em branco entram no denominador e têm contagem separada de erros respondidos.
- Consolidado: soma dos acertos dividida pela soma das questões avaliáveis do recorte. Não é a média simples de percentuais das provas.
- Respondidas: acertos + erros. Total avaliável: respondidas + brancos.
- Área, disciplina e assunto usam exatamente essas fórmulas com seus próprios denominadores. Assuntos de disciplinas diferentes não são fundidos pelo nome.
- Sem questões avaliáveis: percentual indisponível, apresentado como “dados insuficientes”. A ausência de uma área não é nota zero.

## Repetições e evolução

A identidade repetida é o ID canônico da questão. As ocorrências são ordenadas pela finalização; empates usam o ID da tentativa para dar uma ordem determinística. A primeira exposição finalizada é identificada antes dos filtros. É uma exposição na prova, mesmo que a resposta tenha ficado em branco; não se afirma que houve uma visita quando essa telemetria não existe.

O filtro **Somente a primeira resposta** mantém a primeira ocorrência com resposta A–E. Se nunca houve resposta, mantém somente o primeiro branco. A decisão usa o histórico inteiro antes dos filtros; uma primeira resposta fora do período não é substituída pela repetição dentro dele. O relatório mostra quantas ocorrências são primeiras exposições e quantas são repetidas.

Evolução, radar histórico e melhor resultado usam primeiras exposições para excluir reaprendizado/memorização da comparação. Não há uma estimativa causal de aprendizagem. Uma prova composta só por repetições não ganha um zero artificial nos gráficos.

Provas comparáveis têm o mesmo tipo (simulado completo, lista temática ou revisão) e o mesmo conjunto de origens. As proporções por área e disciplina diferem em no máximo 10 pontos percentuais; nas listas, as proporções por assunto também têm essa tolerância. Depois de excluir repetições, a composição da amostra de primeiras exposições é conferida novamente com a mesma tolerância. Duas questões novas de Física, por exemplo, não são comparadas com uma prova inteira de quatro áreas. Um simulado completo tem exatamente 60 questões com 15 em cada área. Tipos de tentativas antigas são inferidos exclusivamente dessa composição; listas não viram simulados completos pelo título.

O radar compara a prova de referência às anteriores comparáveis. As últimas cinco e o melhor resultado incluem a prova de referência se ela tem primeiras exposições. A média das últimas cinco também é ponderada pelo número de questões novas; o relatório mostra quantas tentativas e questões participaram. Os gráficos cronológicos têm grupos separados por tipo e permitem escolher a composição de referência. Evolução por área/assunto compara a primeira e a última tentativa do mesmo grupo, mostrando as amostras; exige duas tentativas para apresentar variação.

## Tempo e revisitas

O relógio existente usa tempo monotônico e checkpoints; não cobra pausas, aba oculta ou tempo fechado. Tempo da ocorrência é a soma dos intervalos ativos naquela questão. Tempo do recorte é a soma dos tempos conhecidos das ocorrências selecionadas, sem acrescentar o tempo de questões excluídas pelos filtros.

Média de tempo: soma dos tempos conhecidos dividida pelo número de ocorrências com tempo registrado, inclusive brancos com tempo conhecido. Zero registrado é um valor real; registro ausente é `null`. Mostramos a cobertura `n/total`. Se não há tempos, total e média ficam indisponíveis, não zero. Na filtragem de primeira resposta, não se soma o tempo das repetições excluídas.

Questões demoradas são ordenadas pelo tempo medido. **Erro muito rápido** é um sinal exploratório: erro abaixo de 25% da mediana dos tempos do recorte; exige pelo menos cinco tempos. O limiar não diagnostica interpretação, cálculo ou outro motivo.

Nas novas tentativas, uma visita é registrada na primeira exibição e ao navegar para uma questão diferente. Retomar pausa na mesma questão não adiciona visita; clicar no índice atual também não. A primeira escolha não é mudança. Trocar ou apagar uma resposta escolhida conta como mudança; escolher novamente a mesma alternativa não conta. O upgrade não cria esses contadores nas tentativas antigas, mesmo que elas sejam retomadas. O relatório informa quantas questões têm registros.

## Prioridades e simulação

Prioridade é um índice heurístico 0–100, não uma previsão de ganho:

- 30%: frequência do assunto entre as questões canônicas oficiais da sua disciplina, com numerador/denominador do acervo apresentado. Não usa terceiros nem conta variantes como novas questões.
- 35%: erros respondidos / questões avaliáveis do assunto nas últimas dez provas com ocorrências no recorte; os brancos são mostrados à parte.
- 20%: quantidade de questões distintas erradas pelo menos duas vezes / quantidade de questões distintas com erro no assunto.
- 15%: carga relativa de tempo: `min(2, média do assunto / média geral recente) / 2`.

Componentes sem amostra são omitidos e os pesos remanescentes são normalizados. Frequência zero com acervo conhecido é distinta de frequência indisponível. O relatório mostra contagens oficiais, erros, brancos, recorrência, provas e tempos usados. A ordenação não promete aumento da nota nem estima o tempo para dominar um assunto.

Simulação de ganho: transforma exclusivamente as ocorrências erradas selecionadas em acertos no cálculo de cenário. Mantém total, brancos e tempo. Não altera tentativas, respostas ou histórico. O botão de revisão usa questões distintas dos erros selecionados, conserva origem/gabarito e marca a nova tentativa como lista de revisão. Seleção de questões reservadas exige confirmação explícita no próprio painel.

## Metas, pesos e redação

Metas são percentuais pessoais; a distância é `max(0, meta - percentual do recorte)`, em pontos percentuais. Não há uma meta presumida.

Nota ponderada é `soma(percentual da área × peso) / soma(pesos)`, na escala 0–100, exclusivamente com pesos configurados pelo usuário nesta versão. Falta de uma área com peso positivo torna a nota indisponível. Áreas com peso zero não exigem amostra. Não é nota oficial nem nota de corte. Não há pesos de curso documentados incorporados.

Redação sem correção é “não avaliada”. Uma correção recebida deve preservar nomes, notas, máximos e comentários dos critérios e sua origem. Esta versão não corrige redações. Questões autorais geradas incluem resolução identificada como IA, com origem e metadados explícitos; a validação autenticada ainda depende do login no computador do usuário. A revisão por IA não é uma resolução oficial. Os cálculos dos indicadores continuam feitos pelo mesmo código para fontes oficiais e autorais, com origens e composições comparáveis separadas.
