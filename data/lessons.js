/* Lesson content. Exercise types:
   teach {title, body} | mc {q, options, a, why} | tf {q, a, why}
   fill {q (with ___), options, a, why} | match {q, pairs} | order {q, items (correct order), why}
   `topics` links a lesson to news topics so stories can suggest it. */
window.KERYKE_LESSONS = [
{ id:'politics', color:'politics', lessons:[
  { id:'pol-spectrum', title:'The political spectrum', blurb:'What left and right actually mean', topics:['government','elections'], items:[
    {type:'teach', title:'Where the words come from', body:'In the French National Assembly of 1789, supporters of the revolution sat to the left of the presiding officer and supporters of the king sat to the right. The labels stuck, but what they mean has shifted across time and between countries.'},
    {type:'mc', q:'Where do the terms "left" and "right" in politics come from?', options:['Seating in the French Assembly of 1789','The two wings of the British Parliament','A chart in a Marx essay','US party logos'], a:0, why:'Seating positions during the French Revolution gave us the labels.'},
    {type:'teach', title:'Two common axes', body:'A single line hides a lot. Many analysts use two axes: economic (more state role vs more market role) and social (more individual liberty vs more traditional authority). Two people can agree on one axis and disagree on the other.'},
    {type:'tf', q:'Someone can favour free markets and also favour liberal social policies.', a:true, why:'That combination is often called libertarian. Economic and social views do not have to line up.'},
    {type:'match', q:'Match each idea to its usual label', pairs:[['Liberalism','Individual rights and limited power'],['Conservatism','Valuing tradition and gradual change'],['Socialism','Collective ownership or strong redistribution'],['Libertarianism','Minimal government in most areas']]},
    {type:'tf', q:'"Centre-right" means the same policies in every country.', a:false, why:'The spectrum is relative. A centrist position in one country can be far from the centre in another.'},
    {type:'fill', q:'Because political labels depend on national context, the spectrum is best described as ___.', options:['relative','fixed','universal'], a:0, why:'Labels only make sense against a country and a time period.'}
  ]},
  { id:'pol-systems', title:'Systems of government', blurb:'Presidents, parliaments and monarchs', topics:['government'], items:[
    {type:'teach', title:'Who runs the executive?', body:'In a presidential system, voters elect the head of government separately from the legislature (Brazil, the US). In a parliamentary system, the government comes from the legislature and can be removed by it (the UK, Japan). Semi-presidential systems split power between a president and a prime minister (France).'},
    {type:'mc', q:'In a parliamentary system, the head of government usually…', options:['Depends on the confidence of the legislature','Is chosen by the courts','Is elected separately for a fixed term','Inherits the position'], a:0, why:'A prime minister can be removed by a vote of no confidence.'},
    {type:'match', q:'Match each country to its system', pairs:[['Brazil','Presidential'],['Japan','Parliamentary'],['France','Semi-presidential'],['Saudi Arabia','Absolute monarchy']]},
    {type:'tf', q:'A constitutional monarchy can also be a democracy.', a:true, why:'Spain, Sweden and Japan all pair a ceremonial monarch with elected government.'},
    {type:'teach', title:'Federal or unitary?', body:'A separate question is how power is divided geographically. Federal states guarantee powers to regions (Germany, India, Brazil). Unitary states concentrate power nationally, even if they delegate some of it (France, Japan).'},
    {type:'fill', q:'A country whose states hold constitutionally guaranteed powers is called ___.', options:['federal','unitary','monarchic'], a:0, why:'Federalism protects regional powers in the constitution itself.'},
    {type:'mc', q:'What does "separation of powers" divide?', options:['Executive, legislative and judicial functions','Rich and poor regions','National and foreign policy','Church and army'], a:0, why:'Splitting these functions lets each branch check the others.'}
  ]},
  { id:'pol-elections', title:'How elections work', blurb:'Why the voting rules shape the result', topics:['elections'], items:[
    {type:'teach', title:'Rules change outcomes', body:'The same votes can produce different governments under different rules. In first-past-the-post, the top candidate in each district wins. In proportional representation, seats roughly follow each party\'s share of the vote.'},
    {type:'mc', q:'Under first-past-the-post, a candidate wins a district by…', options:['Getting the most votes, even without a majority','Getting over 50% of votes','Winning a vote in parliament','Winning most regions'], a:0, why:'A plurality is enough, so a winner can have far less than half of the votes.'},
    {type:'tf', q:'Proportional representation tends to produce more parties in parliament than first-past-the-post.', a:true, why:'Smaller parties can win seats without topping any district, a pattern known as Duverger\'s law.'},
    {type:'match', q:'Match the term to its meaning', pairs:[['Gerrymandering','Drawing districts for partisan gain'],['Runoff','Second round between top candidates'],['Coalition','Parties sharing power to form a majority'],['Turnout','Share of eligible people who vote']]},
    {type:'fill', q:'Drawing district boundaries to favour one party is called ___.', options:['gerrymandering','filibustering','lobbying'], a:0, why:'The name comes from a salamander-shaped district approved by Massachusetts governor Elbridge Gerry in 1812.'},
    {type:'tf', q:'A party can win the most seats while getting fewer total votes than a rival.', a:true, why:'It happens under district systems when a party\'s votes are distributed more efficiently.'}
  ]},
  { id:'pol-media', title:'Reading the news critically', blurb:'Spot framing, bias and missing context', topics:['government','elections','rights'], items:[
    {type:'teach', title:'Bias is often in the choices', body:'Outright falsehood is only one problem. Outlets also differ in which stories they cover, which facts lead, whose quotes appear and which words they use. That is why comparing several sources on the same story reveals so much.'},
    {type:'mc', q:'A headline says "officials claim" for one group and "officials explain" for another. This is an example of…', options:['Framing through word choice','A factual error','A correction','Plagiarism'], a:0, why:'Both may be accurate, but "claim" signals doubt in a way "explain" does not.'},
    {type:'match', q:'Match the type of bias', pairs:[['Selection bias','Choosing which stories to cover'],['Framing','Shaping how a story is understood'],['False balance','Treating unequal evidence as equal'],['Omission','Leaving out relevant facts']]},
    {type:'tf', q:'If a story comes from an outlet you disagree with, it must be false.', a:false, why:'An outlet\'s lean says nothing certain about one article. Check the evidence, not just the source.'},
    {type:'mc', q:'What is the strongest first step when checking a surprising claim?', options:['Find the original source or data','Count how many times it was shared','Check if it fits what you believe','Read the comments'], a:0, why:'Primary sources let you check it yourself, and sharing counts tell you little about accuracy.'},
    {type:'fill', q:'A story covered heavily on one side of the spectrum and barely on the other is called a ___.', options:['blindspot','scoop','retraction'], a:0, why:'A blindspot shows what readers of one side might never see.'}
  ]}
]},
{ id:'economics', color:'economics', lessons:[
  { id:'eco-supply', title:'Supply and demand', blurb:'How markets set prices', topics:['economy'], items:[
    {type:'teach', title:'The basic model', body:'Demand: as price falls, people usually want more. Supply: as price rises, producers usually offer more. The market tends toward the price where the two meet, called equilibrium.'},
    {type:'mc', q:'A drought destroys much of the coffee harvest. All else equal, coffee prices will likely…', options:['Rise','Fall','Stay the same','Become zero'], a:0, why:'Supply falls while demand stays the same, so the price goes up.'},
    {type:'tf', q:'A price ceiling set below the market price tends to create shortages.', a:true, why:'Buyers want more at the low price while sellers offer less.'},
    {type:'match', q:'Match each term to its meaning', pairs:[['Equilibrium','Where supply meets demand'],['Shortage','Demand exceeds supply at a given price'],['Surplus','Supply exceeds demand at a given price'],['Elasticity','How strongly quantity reacts to price']]},
    {type:'fill', q:'Demand for insulin changes little when its price rises, so its demand is ___.', options:['inelastic','elastic','illegal'], a:0, why:'People need it regardless, so quantity barely reacts to price.'},
    {type:'mc', q:'Which is a good example of a "substitute"?', options:['Tea when coffee gets expensive','Petrol when cars get cheaper','Cars when tyres get cheaper','Salt when soup sells more'], a:0, why:'Substitutes replace each other, so demand for tea can rise as coffee prices climb.'}
  ]},
  { id:'eco-inflation', title:'Inflation and central banks', blurb:'Why prices rise and rates move', topics:['economy'], items:[
    {type:'teach', title:'What inflation measures', body:'Inflation is the rate at which the general price level rises. It is commonly tracked with a price index for a basket of goods and services. With 5% inflation, a basket that cost 100 last year costs 105 this year.'},
    {type:'mc', q:'A central bank fighting high inflation will usually…', options:['Raise interest rates','Lower interest rates','Abolish taxes','Close banks'], a:0, why:'Higher rates make borrowing more expensive, which cools spending.'},
    {type:'tf', q:'Deflation means prices are, on average, falling.', a:true, why:'It sounds pleasant but can lead people to delay spending, which hurts the economy.'},
    {type:'match', q:'Match each inflation cause to its example', pairs:[['Demand-pull','Spending outruns what can be produced'],['Cost-push','An oil shock raises production costs'],['Monetary','Rapid growth in the money supply'],['Expectations','Workers and firms anticipate price rises']]},
    {type:'fill', q:'Extremely rapid, out-of-control price rises are called ___.', options:['hyperinflation','stagnation','austerity'], a:0, why:'Weimar Germany and Zimbabwe are well-known historical cases.'},
    {type:'mc', q:'Wages rise 3% while inflation is 5%. What happened to real wages?', options:['They fell about 2%','They rose about 8%','They rose about 3%','They did not change'], a:0, why:'Real wages adjust for prices: you earn more money, but it buys less.'}
  ]},
  { id:'eco-gdp', title:'GDP and growth', blurb:'What the headline number leaves out', topics:['economy'], items:[
    {type:'teach', title:'Measuring an economy', body:'Gross Domestic Product (GDP) is the total market value of final goods and services produced in a country over a period. "Real" GDP adjusts for inflation, and "per capita" divides by population.'},
    {type:'mc', q:'To compare living standards across countries, which is usually more useful?', options:['GDP per capita','Total GDP','The stock market index','The national debt'], a:0, why:'Dividing by population shows average output per person.'},
    {type:'tf', q:'GDP counts unpaid work such as caring for family at home.', a:false, why:'GDP only counts market activity, one of its best-known limitations.'},
    {type:'fill', q:'A common rule of thumb calls two consecutive quarters of falling GDP a ___.', options:['recession','surplus','tariff'], a:0, why:'It is a rule of thumb, and official bodies often use broader measures.'},
    {type:'match', q:'Match the term to its meaning', pairs:[['Nominal GDP','Measured at current prices'],['Real GDP','Adjusted for inflation'],['PPP','Adjusted for local price levels'],['Gini coefficient','A measure of income inequality']]},
    {type:'tf', q:'Rising GDP per capita guarantees that most people are better off.', a:false, why:'It is an average. Gains can be concentrated, so inequality measures add context.'}
  ]},
  { id:'eco-trade', title:'Trade and tariffs', blurb:'Who really pays when borders get costly', topics:['trade','economy'], items:[
    {type:'teach', title:'Why countries trade', body:'Comparative advantage, an idea from David Ricardo, says that countries gain by specialising in what they produce at the lowest opportunity cost, even if another country is better at everything.'},
    {type:'mc', q:'What is a tariff?', options:['A tax on imported goods','A ban on all exports','A subsidy to foreign firms','A type of currency'], a:0, why:'Tariffs raise the cost of imports.'},
    {type:'tf', q:'The cost of a tariff is often passed partly onto domestic consumers and importers.', a:true, why:'Importers pay it at the border and often raise prices, though the split varies by case.'},
    {type:'match', q:'Match each term to its meaning', pairs:[['Quota','A limit on the quantity imported'],['Subsidy','Government support for a producer'],['Sanction','A penalty restricting dealings with a state'],['Trade deficit','Importing more than exporting']]},
    {type:'fill', q:'The idea that countries should specialise by lowest opportunity cost is called comparative ___.', options:['advantage','inflation','protection'], a:0, why:'This is the core argument economists make for gains from trade.'},
    {type:'mc', q:'Which is a common argument FOR protecting an industry with tariffs?', options:['Protecting jobs or strategic production','Making imports cheaper','Reducing government revenue','Raising consumer choice'], a:0, why:'Supporters cite jobs and security, while critics cite higher prices and retaliation.'}
  ]}
]},
{ id:'social', color:'social', lessons:[
  { id:'soc-rights', title:'Rights and constitutions', blurb:'What protects people from power', topics:['rights','government'], items:[
    {type:'teach', title:'Rules for the rulers', body:'A constitution sets out how a state is organised and limits what its government may do. Rule of law means that everyone, including officials, is bound by the law and that the law applies predictably.'},
    {type:'mc', q:'What does "rule of law" mean?', options:['Even leaders are subject to the law','The ruler makes the law alone','Police decide all disputes','Laws never change'], a:0, why:'No person or office stands above the law.'},
    {type:'match', q:'Match each document to its origin', pairs:[['Magna Carta','England, 1215'],['Universal Declaration of Human Rights','United Nations, 1948'],['Declaration of the Rights of Man','France, 1789'],['Citizen Constitution','Brazil, 1988']]},
    {type:'tf', q:'Every democracy has a single written constitutional document.', a:false, why:'The UK, for example, relies on statutes, conventions and court rulings.'},
    {type:'fill', q:'A court\'s power to strike down laws that break the constitution is called judicial ___.', options:['review','recess','immunity'], a:0, why:'It is a major check on legislatures, although its reach varies by country.'},
    {type:'mc', q:'Which is usually classed as a civil or political right?', options:['Freedom of expression','The right to a specific job','A guaranteed car','A right to win elections'], a:0, why:'Civil and political rights protect individuals\' freedom to participate in public life.'}
  ]},
  { id:'soc-demography', title:'People and migration', blurb:'How populations shape politics', topics:['migration'], items:[
    {type:'teach', title:'The demographic transition', body:'As countries develop, death rates tend to fall first and birth rates later. Populations grow fast during that gap and later age. Ageing populations put pressure on pensions and health systems.'},
    {type:'mc', q:'Which is a typical political challenge of an ageing society?', options:['Funding pensions and health care','Too many schoolchildren','Falling life expectancy','Excess military recruits'], a:0, why:'Fewer workers must support more retirees.'},
    {type:'match', q:'Match the term to its meaning', pairs:[['Refugee','Fled persecution or conflict across a border'],['Asylum seeker','Has requested protection, not yet decided'],['Economic migrant','Moves mainly for work or income'],['Internally displaced person','Forced to flee but inside their country']]},
    {type:'tf', q:'International law protects refugees from being returned to places where they face serious threats.', a:true, why:'This is the principle of non-refoulement, from the 1951 Refugee Convention.'},
    {type:'fill', q:'The number of children per woman needed to keep a population stable, about 2.1, is called ___ fertility.', options:['replacement','peak','base'], a:0, why:'Many countries are now below this level.'},
    {type:'mc', q:'Money that migrants send home to their families is called…', options:['Remittances','Tariffs','Subsidies','Dividends'], a:0, why:'In some countries, remittances are a large share of GDP.'}
  ]},
  { id:'soc-inequality', title:'Inequality and the state', blurb:'Taxes, welfare and who gets what', topics:['economy','health'], items:[
    {type:'teach', title:'Income vs wealth', body:'Income is what flows in over a period, such as wages. Wealth is what you own at a point in time, such as property and savings. Wealth is usually more unequally distributed than income.'},
    {type:'mc', q:'A Gini coefficient of 0 means…', options:['Perfect equality','Perfect inequality','Zero GDP','No taxes'], a:0, why:'Zero means everyone has the same share, and values nearer 1 mean greater inequality.'},
    {type:'match', q:'Match the tax type to its meaning', pairs:[['Progressive','Higher earners pay a larger share'],['Regressive','Lower earners pay a larger share'],['Flat','Everyone pays the same rate'],['VAT','Tax charged on consumption']]},
    {type:'tf', q:'Economists and voters broadly disagree about how much redistribution is best.', a:true, why:'It involves trade-offs among fairness, incentives and growth, and also differing values.'},
    {type:'fill', q:'A state that provides pensions, health care and unemployment support is called a ___ state.', options:['welfare','rentier','client'], a:0, why:'Scope and funding vary widely by country.'},
    {type:'mc', q:'Which tax tends to be the most regressive?', options:['A flat sales tax on essentials','A top income tax bracket','An inheritance tax on large estates','A tax on luxury yachts'], a:0, why:'Lower earners spend a larger share of income on essentials.'}
  ]},
  { id:'soc-world', title:'International institutions', blurb:'The UN, NATO, IMF and how they work', topics:['diplomacy','security'], items:[
    {type:'teach', title:'Rules between states', body:'No world government exists. States create institutions to manage shared problems, and these depend on the consent and power of members. The UN was founded in 1945 to maintain peace and security after World War II.'},
    {type:'mc', q:'Which body can adopt binding resolutions and has five permanent members with vetoes?', options:['UN Security Council','UN General Assembly','World Bank','G20'], a:0, why:'The veto holders are China, France, Russia, the UK and the US.'},
    {type:'match', q:'Match each institution to its main role', pairs:[['IMF','Loans for balance-of-payments crises'],['WTO','Rules for international trade'],['NATO','Collective defence alliance'],['ICJ','Disputes between states']]},
    {type:'tf', q:'NATO\'s Article 5 treats an armed attack on one member as an attack on all.', a:true, why:'It has only been invoked once, after the attacks of 11 September 2001.'},
    {type:'fill', q:'The principle that a state has authority over its own territory is called ___.', options:['sovereignty','hegemony','autarky'], a:0, why:'Tension between sovereignty and international action runs through world politics.'},
    {type:'tf', q:'UN General Assembly resolutions are generally legally binding on all members.', a:false, why:'They are mostly recommendations, while certain Security Council decisions bind members.'}
  ]}
]},
{ id:'history', color:'history', lessons:[
  { id:'his-revolutions', title:'The age of revolutions', blurb:'How modern politics began', topics:['government','rights'], items:[
    {type:'teach', title:'A new idea of legitimacy', body:'From the late 1700s, revolutions in the Americas and Europe spread a new idea: that government draws legitimacy from the people rather than from divine right. They also produced violence and new forms of exclusion.'},
    {type:'order', q:'Put these events in chronological order', items:['American Declaration of Independence','Storming of the Bastille','Haitian independence','Independence of Brazil'], why:'1776, 1789, 1804 and 1822.'},
    {type:'mc', q:'The Haitian Revolution is especially notable because…', options:['Enslaved people overthrew colonial rule','It restored the French monarchy','It was bloodless','It created a British colony'], a:0, why:'It led to the first state founded after a successful revolt by enslaved people.'},
    {type:'tf', q:'The 1917 October Revolution brought the Bolsheviks to power in Russia.', a:true, why:'Led by Lenin, they went on to establish the Soviet state.'},
    {type:'fill', q:'The idea that government authority comes from the people is called popular ___.', options:['sovereignty','monarchy','austerity'], a:0, why:'It became a foundation of modern constitutions.'},
    {type:'match', q:'Match each figure to their revolution', pairs:[['Robespierre','French'],['Toussaint Louverture','Haitian'],['Simón Bolívar','South American independence'],['Lenin','Russian']]}
  ]},
  { id:'his-wars', title:'The world wars', blurb:'The conflicts that built today\'s order', topics:['security','diplomacy'], items:[
    {type:'teach', title:'Two catastrophes', body:'World War I (1914–1918) broke up empires and left unresolved grievances. World War II (1939–1945) was the deadliest conflict in history, and included the Holocaust. The postwar order, including the UN, grew from those events.'},
    {type:'mc', q:'Which event triggered the outbreak of World War I in 1914?', options:['Assassination of Archduke Franz Ferdinand','Invasion of Poland','The Russian Revolution','Bombing of Pearl Harbor'], a:0, why:'The Sarajevo killing set off a chain of alliance commitments.'},
    {type:'order', q:'Put these events in chronological order', items:['Treaty of Versailles','Germany invades Poland','Attack on Pearl Harbor','Founding of the United Nations'], why:'1919, 1939, 1941 and 1945.'},
    {type:'tf', q:'The Treaty of Versailles imposed heavy terms on Germany after World War I.', a:true, why:'Historians still debate how much it contributed to later events, but resentment of it was real.'},
    {type:'fill', q:'The US program of aid that helped rebuild Western Europe after 1945 was the ___ Plan.', options:['Marshall','Monroe','Schuman'], a:0, why:'It was announced in 1947 by Secretary of State George Marshall.'},
    {type:'match', q:'Match each term to its meaning', pairs:[['Appeasement','Conceding to avoid war'],['Holocaust','Nazi genocide of Europe\'s Jews'],['Nuremberg Trials','Prosecution of Nazi leaders'],['Axis','Germany, Italy and Japan']]}
  ]},
  { id:'his-coldwar', title:'The Cold War', blurb:'Two superpowers and a divided world', topics:['security','diplomacy'], items:[
    {type:'teach', title:'War without direct war', body:'From the late 1940s to 1991, the US and USSR competed globally without fighting each other directly. Nuclear weapons made direct war unthinkably costly, so rivalry played out through alliances, proxy wars, economics and propaganda.'},
    {type:'order', q:'Put these events in chronological order', items:['Berlin Wall goes up','Cuban Missile Crisis','Fall of the Berlin Wall','Dissolution of the USSR'], why:'1961, 1962, 1989 and 1991.'},
    {type:'mc', q:'"Mutually assured destruction" refers to…', options:['Nuclear war would destroy both sides','A trade deal','A joint space program','A UN peacekeeping force'], a:0, why:'Each side\'s second-strike capability was meant to deter the other from attacking first.'},
    {type:'match', q:'Match each term to its meaning', pairs:[['Containment','US policy to limit Soviet expansion'],['Iron Curtain','Division of Europe'],['Détente','Easing of tensions in the 1970s'],['Non-Aligned Movement','States avoiding both blocs']]},
    {type:'tf', q:'The Korean and Vietnam wars are often described as Cold War proxy conflicts.', a:true, why:'The superpowers backed opposing sides, though both wars also had deep local causes.'},
    {type:'fill', q:'The Soviet-led military alliance formed in 1955 was the ___ Pact.', options:['Warsaw','Moscow','Geneva'], a:0, why:'It was a counterpart to NATO and dissolved in 1991.'}
  ]},
  { id:'his-decolonization', title:'Decolonization', blurb:'Empires fall and new nations rise', topics:['diplomacy','rights'], items:[
    {type:'teach', title:'A world remade', body:'In 1945, much of Africa and Asia was under European colonial rule. Within about three decades, dozens of new states had formed. Many inherited borders, economies and institutions shaped by colonial rule, and those legacies still matter today.'},
    {type:'order', q:'Put these independence moments in chronological order', items:['India and Pakistan','Ghana','Algeria','Angola'], why:'1947, 1957, 1962 and 1975.'},
    {type:'mc', q:'Which 1884–85 conference is known for European powers setting rules to claim Africa?', options:['Berlin Conference','Yalta Conference','Bandung Conference','Congress of Vienna'], a:0, why:'African leaders were not represented at the conference.'},
    {type:'tf', q:'The 1955 Bandung Conference brought together Asian and African states, many newly independent.', a:true, why:'It helped pave the way for the Non-Aligned Movement.'},
    {type:'fill', q:'Economic and political influence that continues after formal independence is often called ___.', options:['neocolonialism','mercantilism','federalism'], a:0, why:'Kwame Nkrumah, Ghana\'s first leader, popularised the term.'},
    {type:'match', q:'Match each leader to their country', pairs:[['Gandhi','India'],['Nkrumah','Ghana'],['Sukarno','Indonesia'],['Lumumba','Congo']]}
  ]}
]}
];
