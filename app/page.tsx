export default function Home() {
  return (
    <>
      <header id="topbar">
        <div className="wordmark">
          <span className="wm-zh">知识大地</span>
          <span className="wm-en">TERRA{"\u00A0"}COGNITA</span>
        </div>
        <nav id="tabs">
          <button className="tab active" data-view="map">星图</button>
          <button className="tab" data-view="flow">河流</button>
          <button className="tab" data-view="frontier">前沿</button>
          <button className="tab" data-view="timeline">时间轴</button>
          <button className="tab" data-view="about">图志</button>
          <button className="tab" data-view="api">开放 API</button>
          <button className="tab" data-view="curate">策展台</button>
        </nav>
        <div id="searchWrap">
          <input id="search" type="text" placeholder="搜索概念、技术、人物…" autoComplete="off" />
          <div id="searchDrop" hidden></div>
        </div>
        <div id="stats" title="底图版次"></div>
      </header>

      <main>
        {/* ============ 星图 ============ */}
        <section id="view-map">
          <canvas id="cv" />

          <div id="legend" className="atlas-box">
            <h3>图例</h3>
            <div id="legendDomains"></div>
            <div id="legendTypes"></div>
            <button id="legendReset">全部显示</button>
          </div>

          <div id="timebar">
            <button id="playBtn" title="从最早年代重放整张地图的生长">▷ 重放生长</button>
            <div id="sliderWrap">
              <input id="yearRange" type="range" min={0} max={1000} value={1000} step={1} aria-label="年代尺(分段线性)" />
              <div id="ticks">
                <span style={{ left: "0%" }}>前8000</span><span style={{ left: "25%" }}>前4000</span><span style={{ left: "40%" }}>前2000</span><span style={{ left: "50%" }}>前500</span><span style={{ left: "62%" }}>1000</span><span style={{ left: "72%" }}>1600</span><span style={{ left: "88%" }}>1900</span><span style={{ left: "100%" }}>2026</span>
              </div>
            </div>
            <div id="yearLabel">全部年代</div>
          </div>

          <div id="storyChips"></div>

          <div id="storyBox" hidden>
            <div className="story-head">
              <span id="storyTitle"></span>
              <button id="storyClose" aria-label="关闭导览">✕</button>
            </div>
            <p id="storyText"></p>
            <div className="story-nav">
              <button id="storyPrev">← 上一步</button>
              <span id="storyStep"></span>
              <button id="storyNext">下一步 →</button>
            </div>
          </div>

          <div id="hint">拖动平移 · 滚轮缩放 · 单击看概念卡 · 双击聚焦 · 拖动年代尺看地图生长</div>
        </section>

        {/* ============ 河流: 成熟度管道 ============ */}
        <section id="view-flow" hidden>
          <div className="view-head">
            <h2>成熟度管道 · 知识如何长成技术</h2>
            <p>五个阶段自左向右：<b>知识(理论与概念) → 方法 → 工艺 → 技术 → 产品</b>。每条彩带是一句跨阶段的判断（"A 使能了 B"），粗细即权重，颜色随出发阶段。悬停看单条链路，单击节点段打开概念卡。找一找那条跨越全图的彩带——量子力学一路流进你口袋里的手机。</p>
          </div>
          <canvas id="flowCv" />
        </section>

        {/* ============ 前沿 ============ */}
        <section id="view-frontier" hidden>
          <div className="view-head">
            <h2>前沿 · 正在生长与正在卡住的地方</h2>
            <p>三张榜单全部由图结构实时算出，不是编辑推荐：<b>生长热力</b>是出生最晚且高连接的节点（哪里在变亮）；<b>瓶颈卡点</b>是带"受制于"边的堵点与活跃的未解问题（哪里是红灯）；<b>待连接</b>是用链接预测(共同邻居相似度)找出的"两个都已成熟、却还没有边"的概念对——邻近可能意义上的候选创新。</p>
            <button id="heatBtn" className="ghost-btn">▷ 在星图上叠加生长热力层</button>
          </div>
          <div id="frCols">
            <div className="fr-col"><h3>生长热力 · 最年轻的高连接节点</h3><div className="fr-list" id="frActive"></div></div>
            <div className="fr-col"><h3>瓶颈卡点 · 受制于</h3><div className="fr-list" id="frBlock"></div></div>
            <div className="fr-col"><h3>待连接 · 邻近可能候选</h3><div className="fr-list" id="frPairs"></div></div>
            <div className="fr-col"><h3>生长大陆 · 2005 年以来新增</h3><div className="fr-list" id="frGrowth"></div></div>
          </div>
        </section>

        {/* ============ 领域门户(动态生成) ============ */}
        <section id="view-domain" hidden></section>

        {/* ============ 策展台 ============ */}
        <section id="view-curate" hidden>
          <div className="view-head">
            <h2>策展台 · 人机协作的知识质检线</h2>
            <p id="curateStatus">正在连接本地服务…</p>
          </div>
          <div id="curateWrap">
            <div className="cur-col"><h3>待策展节点 <span id="curNodeN"></span></h3>
              <div className="cur-toolbar"><select id="curDom"></select><button className="ghost-btn" id="curRefresh">刷新</button></div>
              <div id="curNodes"></div>
            </div>
            <div className="cur-col"><h3>待判读共现对 <span id="curPairN"></span></h3>
              <p className="cur-hint">依据维基原文证据句，为两概念选择关系类型；判错可重来。</p>
              <div id="curPairs"></div>
            </div>
          </div>
        </section>

        {/* ============ 时间轴 ============ */}
        <section id="view-timeline" hidden>
          <div id="tlHead">
            <h2>长时段 · 多域并置</h2>
            <p>横轴为年代（前 8000 → 2026，远古压缩），各学科域泳道自上而下。<b>淡蓝密度</b>=该时段全部节点的数量分布；<b>彩色点</b>=已策展节点（事件为菱形，重要者带标签，灰暗为化石）。<b>悬停</b>看时段与节点，<b>点击彩色点</b>直接开概念卡，<b>点击密度块</b>展开该时段的完整节点清单。年代尺仍然生效。</p>
          </div>
          <div id="tlScroll"><canvas id="tlCv" /><div id="tlPop" hidden></div></div>
        </section>

        {/* ============ 图志(方法论) ============ */}
        <section id="view-about" hidden>
          <div className="about-wrap">
            <div className="edition-stamp">
              <span id="stampNo">底图 · 第一版次</span>
              <span id="stampDate"></span>
            </div>
            <h1>这是一张会生长的地图</h1>
            <p className="lede">它画的不是"知识现在长什么样"的快照，而是"知识如何生长"的过程。每一盏灯是一个被人类理解过的东西——概念、理论、技术、材料、争议、未解问题；每一条线是一句带证据的判断：<b>"A 奠基于 B""A 使能了 B""A 被推翻于某年"</b>。</p>

            <div className="about-grid">
              <div className="about-card">
                <h2>知识如何生长——八条机制</h2>
                <ol className="mech">
                  <li><b>组合律</b> 新知识多半是旧知识的重新组合——手机=电话+相机+电脑。</li>
                  <li><b>邻近可能</b> 新东西只能长在已有结构的边缘——没有半导体，就不可能先有软件业。</li>
                  <li><b>工具循环</b> 技术造仪器，仪器开新观察，新观察生新理论——显微镜→细胞学说→细菌学。</li>
                  <li><b>范式转移</b> 危机积累到临界，整片地图被重新连边——牛顿力学让位于相对论。</li>
                  <li><b>楔形分叉</b> 争议节点裂成两支——光的波动说与粒子说在"波粒二象性"合流。</li>
                  <li><b>迁移律</b> 方法跨域搬迁就地成域——熵从热力学迁移进了信息论。</li>
                  <li><b>瓶颈决定论</b> 生长卡在测量、材料、算力、理论四类堵点上——图上的红色"受制于"边。</li>
                  <li><b>化石律</b> 被推翻的知识不删除：以太、冷聚变仍灰暗地在图上，带着它们如何死去的证据。</li>
                </ol>
              </div>

              <div className="about-card">
                <h2>知识如何长成技术</h2>
                <pre className="pipe">{`科学发现 → 理论成熟 → 方法成型 → 工艺突破 → 产品出现 → 产业形成
    ↑                                            │
    └──────────── 仪器反哺(工具循环) ←────────────┘`}</pre>
                <p>图上沿着绿色系"工程化/产品化"的边走，就是这条管道；沿着黄铜色虚线"反哺"的边回流，是闭环。每条边自带<b>起始年份</b>——知识变成技术的时滞本身是被测量的。</p>
                <h2>诚实性是一等公民</h2>
                <table className="grades">
                  <tr><td className="g gA">A</td><td>权威文献直接支持（论文、教科书、专利原文）</td></tr>
                  <tr><td className="g gB">B</td><td>专家共识 / 权威分类体系</td></tr>
                  <tr><td className="g gC">C</td><td>模型自动抽取，未经人工复核（后续版本开放显示）</td></tr>
                  <tr><td className="g gD">D</td><td>推测与用户贡献，仅作探索线索</td></tr>
                </table>
                <p>红色"未解问题"与紫红色"争议"节点不是地图的缺陷，而是地图最亮的部分：<b>未知之地（terra incognita）。</b></p>
              </div>

              <div className="about-card">
                <h2>完备度指标 <span style={{ fontWeight: "normal", fontSize: "11px", color: "#5a6678" }}>(每次导出自动更新)</span></h2>
                <div id="metricsBox"><p>计算中…</p></div>
              </div>
              <div className="about-card">
                <h2>怎么读这张图</h2>
                <ul className="howto">
                  <li><b>星图</b>——全景。节点大小代表连接数，簇即学科大陆。单击任何节点看它的概念卡：定义、奠基链、通向哪里、证据。</li>
                  <li><b>年代尺</b>——把滑块向左拖，地图倒带回 1600 年再放一遍，你会亲眼看到知识按年代长出来。<b>▷ 重放生长</b> 一键播放。</li>
                  <li><b>故事</b>——左下角的三条导览："一粒沙的远征""一支疫苗的六十年""看见，然后理解"。</li>
                  <li><b>时间轴</b>——长时段视角，四个学科域并置，看每个时代都发生了什么。</li>
                </ul>
                <h2>这个版本的边界</h2>
                <p>当前版次（v0.3）：16 个学科域骨架全覆盖，<b>物理学、计算机、生物技术</b>三域深描，其余各域为骨架+批量生长层；<span id="stampNodes">497</span> 个节点、839 条边。种子策展层人工校订，批量层标注为 C 级置信度待策展。完备的骨架与自动抽取管线是下一版次的目标——完整设计见 <a href="知识技术底图-十倍扩展设计.md">《知识技术底图 · 十倍扩展设计》</a>。</p>
              </div>
            </div>
          </div>
        </section>
        {/* ============ 开放 API ============ */}
        <section id="view-api" hidden>
          <div className="about-wrap">
            <h1>开放数据接口</h1>
            <p className="lede">这张图的最高层用户不是人，是 AI Agent 与第三方应用。全部数据以静态 JSON 开放（本站是"API-first"的：网页只是图的一个视图）。</p>
            <div className="about-card" style={{ maxWidth: "760px" }}>
              <h2>端点</h2>
              <div id="apiTable"></div>
              <h2>用法</h2>
              <pre className="pipe">
                {"# 全图(节点+边): 约 "}
                <span id="apiSize"></span>
                {"\ncurl -s http://127.0.0.1:8123/api/graph.json | head -c 400\n\n# 只要节点清单 / 只要边清单 / 元信息 / 故事\ncurl -s http://127.0.0.1:8123/api/nodes.json\ncurl -s http://127.0.0.1:8123/api/edges.json\ncurl -s http://127.0.0.1:8123/api/meta.json\ncurl -s http://127.0.0.1:8123/api/stories.json"}
              </pre>
              <p>graph.json 的节点与边即 <code>js/data.js</code> 的解码结果：节点含类型/中英名/出生年/状态/证据/置信度，边含类型/权重/起始年份。生成脚本 <code>build-api.js</code> 在每次数据更新后重跑，保证 API 与网站所见永远同源。</p>
              <p>许可：数据遵循其来源的许可（Wikipedia 内容 CC BY-SA，需署名并以相同方式共享）；使用时请保留节点中的证据溯源字段。</p>
              <p id="apiFetchNote" style={{ color: "var(--brass)" }}></p>
            </div>
          </div>
        </section>
      </main>

      <aside id="panel" hidden></aside>
      <div id="tooltip" hidden></div>
    </>
  );
}
