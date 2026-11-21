export function MethodHelp() {
  return (
    <details className="muscle-v2-help">
      <summary>Como funciona</summary>
      <div>
        <h4>Esforço relativo, sem medir ativação</h4>
        <p>
          Somente séries válidas realizadas em sessões concluídas até hoje. Cada
          série direta vale 1; cada participação secundária, 0,5. O índice é 100
          × séries equivalentes do grupo ÷ maior total entre os grupos na janela
          escolhida. O grupo com maior total recebe 100%; isso não é meta, 1RM
          ou ativação fisiológica. Sem registro, mostramos indeterminado.
        </p>
        <p>
          Volume envolvido = carga × repetições das séries em que o grupo
          participa. Não é uma divisão da tonelagem do treino: não some os
          volumes de diferentes grupos. Os lados e subdivisões recebem os dados
          do mesmo grupo.
        </p>
        <h4>Principal, secundário e estabilizador</h4>
        <p>
          Cada exercício tem papéis por grupo. Principal vale 1 por série;
          secundário, 0,5. Estabilizador (por exemplo, o abdômen no agachamento
          ou o glúteo médio no afundo) aparece na lista de exercícios do grupo,
          mas não vira série equivalente nem carga de recuperação. Lombar,
          adutores e abdutores são grupos do mapa derivados de uma revisão do
          catálogo; exercícios próprios mantêm os papéis cadastrados. Não usamos
          porcentagens de eletromiografia como medida de estímulo.
        </p>
        <h4>Recuperação: índice estimado, com incerteza</h4>
        <p>
          Usamos os estímulos dos últimos 14 dias, independentemente do filtro
          de esforço. A carga residual de cada estímulo contabilizado cai pela
          metade a cada 48 horas, contadas continuamente a partir do início
          registrado do treino, sem salto na virada da meia-noite. Por isso, sem
          novos treinos, o índice de recuperação estimada sobe com o tempo.
          Participações estabilizadoras não entram na fórmula. Sem horário
          registrado, usamos o menor tempo possível desde o fim daquele dia
          (estimativa conservadora). As participações se somam: treinos
          frequentes mantêm maior carga residual. Índice = 100 × exp(−carga
          residual ÷ 12), limitado a 99. Não significa porcentagem de tecido
          recuperado nem autorização para treinar.
        </p>
        <p>
          RIR preenchido de 0 a 3 aumenta o peso em até 20%; ausência é mantida
          como desconhecida, sem presumir falha. Quando há ao menos dois
          registros anteriores do mesmo exercício em 28 dias, um aumento de
          volume pode ampliar o peso em até 50%: fator = limite(raiz(volume
          atual ÷ mediana anterior), 1, 1,5). Não comparamos quilos de
          exercícios diferentes.
        </p>
        <p>
          48 horas, 12 participações, 0,5, 20%, 50% e os limiares de cores são
          heurísticas configuráveis do aplicativo, não parâmetros clínicos
          validados. O horário representa o início do treino; a duração não é
          inferida. A estimativa é atualizada a cada minuto com a tela visível.
          Sono, dor, alimentação, novidade e experiência individual não são
          inferidos. Sem estímulo recente ou mapeamento, o estado é
          indeterminado.
        </p>
        <h4>O que a pesquisa sustenta</h4>
        <p>
          Estudos sobre{' '}
          <a
            href="https://pubmed.ncbi.nlm.nih.gov/28965198/"
            target="_blank"
            rel="noreferrer"
          >
            treino até a falha
          </a>{' '}
          e{' '}
          <a
            href="https://pubmed.ncbi.nlm.nih.gov/30036284/"
            target="_blank"
            rel="noreferrer"
          >
            configurações de séries
          </a>{' '}
          mostram que o curso da recuperação depende do protocolo. A{' '}
          <a
            href="https://pubmed.ncbi.nlm.nih.gov/30663816/"
            target="_blank"
            rel="noreferrer"
          >
            exposição prévia
          </a>{' '}
          e o{' '}
          <a
            href="https://pubmed.ncbi.nlm.nih.gov/36136596/"
            target="_blank"
            rel="noreferrer"
          >
            sono
          </a>{' '}
          também importam. Esses estudos não validam nossa fórmula ou um prazo
          universal de recuperação.
        </p>
        <p>
          Estimativa baseada no histórico registrado; não substitui percepção de
          fadiga e recuperação.
        </p>
        <small>
          Anatomia:{' '}
          <a
            href="https://github.com/Jsplice/MuscleMap"
            target="_blank"
            rel="noreferrer"
          >
            MuscleMap · Jsplice e colaboradores
          </a>
          , licença MIT. Vetores originais traçados; bases visuais geradas por
          IA e editadas pelo autor.
        </small>
      </div>
    </details>
  );
}
