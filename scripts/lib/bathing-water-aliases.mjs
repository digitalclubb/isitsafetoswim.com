// The EA names a bathing water in the EDM return using its own shorthand, which
// is not always the name the catalogue carries: a landmark rather than the
// stretch of water ("Saltburn Pier"), a town where we hold the named beach
// ("Broadstairs"), or the river rather than the site on it ("Erme Estuary").
//
// Keyed by the EA's name reduced to lowercase alphanumerics, valued by our
// slug. Only entries confirmed against the outfall's own coordinates are
// listed: every one of these resolves to a bathing water the tagged outfalls
// actually sit beside.
//
// Names the EA uses that are not designated bathing waters we hold at all,
// Silloth, Instow, Burnham Jetty North and the Colne among them, are left out
// on purpose. There is nothing to point them at, and inventing a nearest
// neighbour would attribute spills to the wrong beach.
//
// So are the town names covering several beaches we hold: a bare "Broadstairs"
// could be any of four, "Margate" any of four, "Windermere" any of four, and
// picking one would put a spill on a beach that may not have had it.

export const aliasToSlug = {
	// Named for a pier, a headland or a town, where we hold the beach.
	newbrighton: 'new-brighton-beach-east',
	southsea: 'southsea-east',
	stannespier: 'st-annes',
	saltburnpier: 'saltburn',
	whitstable: 'west-beach-whitstable',
	westbeach: 'west-beach-whitstable',
	vikingbay: 'broadstairs-viking-bay',
	clactonmartellotower: 'clacton-beach-martello-tower',
	clactongroyne41: 'clacton',
	marske: 'marske-sands',
	lancing: 'lancing-beach-green',
	beachgreen: 'lancing-beach-green',
	walpolebay: 'walpole-bay-margate',
	stonebay: 'broadstairs-stone-bay',
	botanybay: 'botany-bay-broadstairs',
	jossbay: 'joss-bay-broadstairs',
	cullercoats: 'tynemouth-cullercoats',
	sandgate: 'sandgate-granville-parade',
	seahamhall: 'seaham-hall-beach',
	ingoldmellssouth: 'ingoldmells',
	allonbysouth: 'allonby',
	lowestoftnorth: 'lowestoft-north-of-claremont-pier',
	seaburnwhitburnnorth: 'seaburn-sunderland',
	bridlingtonsouthbay: 'bridlington-south-beach',
	bridlingtonnorthbay: 'bridlington-north-beach',
	morcambenorth: 'morecambe-north',

	// Rivers, estuaries and lakes named for the water body rather than the site.
	dartestuary: 'steamer-quay-dart-estuary',
	steamerquay: 'steamer-quay-dart-estuary',
	dittisham: 'dittisham-dart-estuary',
	warfleetcreek: 'warfleet-creek-dart-estuary',
	ermeestuary: 'coastguards-beach-erme-estuary',
	coastguardsbeach: 'coastguards-beach-erme-estuary',
	riverstour: 'friars-meadow-river-stour',
	friarsmeadow: 'friars-meadow-river-stour',
	wharfeatcromwheel: 'wharfe-at-cromwheel-ilkley',
	ilkley: 'wharfe-at-cromwheel-ilkley',
	niddatthelido: 'nidd-at-the-lido-knaresborough',
	knaresborough: 'nidd-at-the-lido-knaresborough',
	millergroundlanding: 'windermere-millerground-landing',
	rayriggmeadow: 'windermere-rayrigg-meadow',

	// Written in full caps, or with a suffix the catalogue leaves off. Only the
	// ones a plain "drop the trailing beach" rule cannot reach are listed.
	beachlandswest: 'hayling-beachlands-west',
	beachlandscentral: 'hayling-beachlands-central',
	eastoke: 'hayling-eastoke',
	seatonbeachcornwall: 'seaton-cornwall',
	seatonbeach: 'seaton-devon',

	// Described by route rather than named.
	indirectlyviascalbybecktoscarboroughnorthbay: 'scarborough-north-bay'
};
