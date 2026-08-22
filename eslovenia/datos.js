/* ═══════════════════════════════════════════════════════════
   Eslovenia y Venecia · los datos del viaje

   Aquí está el viaje entero y nada más: vuelos, coche, seguros,
   teléfonos, alojamientos, los doce días con sus paradas, la guía
   de lugares y la información práctica. La app (index.html) pone
   la estructura y assets/app.js el motor.

   Se carga antes que el resto para que el motor lo encuentre ya
   definido. Va sin ?v=: la versión la lleva eslovenia/sw.js, y si
   se toca este archivo hay que subir su CACHE o el móvil seguirá
   con los datos viejos.
   ═══════════════════════════════════════════════════════════ */

const VIAJE = {
  nombre: "Eslovenia · Venecia",
  anio: 2026,

  vuelos: [
    { ruta:"Madrid MAD → Venecia VCE", fecha:"Sáb 18 jul", hora:"18:55",
      cia:"Wizz Air Malta", loc:"VJEL5V", terminal:"" },
    { ruta:"Venecia VCE → Madrid MAD", fecha:"Mié 29 jul", hora:"05:45",
      cia:"Wizz Air Malta", loc:"VJEL5V", vuelo:"W46729",
      terminal:"Llega a la T2 de Barajas",
      puerta:"La puerta cierra a las 05:15",
      asientos:[["Dani","22D · priority"],["Pilar","35C · priority"]],
      secuencia:[["Dani","0036"],["Pilar","0027"]] }
  ],

  // Acceso a la web de la aerolínea para gestionar la reserva
  acceso: {
    cia:"Wizz Air Malta",
    email:"keeley0buckridge@aeroview.xin",
    url:"https://wizzair.com"
  },

  coche: {
    intermediario:"Discover Cars",
    proveedor:"Last Minute Rent",
    reserva:"D014608185",
    confirmacion:"83286",
    conductor:"María Pilar Huerta Checa",
    coche:"Fiat Panda o similar · manual · A/A",
    recogida:"Dom 19 jul · 15:00 · Venecia VCE",
    devolucion:"Mar 28 jul · 15:00 · Venecia VCE",
    direccion:"Via Triestina 94, 30173 Venecia",
    horario:"08:00 – 21:30 todos los días",
    telefono:"+39 342 013 8930",
    pagar:"108 € al llegar · fianza 600 € retenida",
    combustible:"Lleno → lleno · kilometraje ilimitado",
    franquicia:"Franquicia del proveedor: 2.000 €",
    llegada:"Puerta 4 de llegadas → dirección P5 → túnel blanco 50 m → llamar al +39 342 013 8930 para la lanzadera"
  },

  seguros: [
    { nombre:"Cobertura Total", poliza:"P-FC-26-XN5KR5H8", limite:"3.000 €",
      que:"Daños al coche: carrocería, lunas, ruedas, bajos, robo, grúa, llaves, repostaje incorrecto. Taxi hasta 300 €.",
      no:"No cubre responsabilidad civil ni objetos personales." },
    { nombre:"Protección de Movilidad", poliza:"P-MP-26-XN5KR5K2", limite:"3.000 €",
      que:"Si el coche se avería: coche de sustitución, taxi hasta 500 €, hotel de emergencia 1 noche hasta 500 €.",
      no:"No cubre daños al vehículo." }
  ],

  telefonos: [
    { q:"Last Minute Rent", sub:"El proveedor del coche. Averías, retrasos y dudas en la entrega",
      n:"+39 342 013 8930", wa:true },
    { q:"Sincera · coche de sustitución", sub:"Si el coche se queda tirado y necesitáis otro",
      n:"+39 06 9763 9380", wa:false },
    { q:"Sincera · línea Reino Unido", sub:"Alternativa si la línea italiana no responde",
      n:"+44 2045 774280", wa:false },
    { q:"Emergencias", sub:"Válido en Eslovenia y en Italia. Bomberos, ambulancia y rescate en montaña",
      n:"112", wa:false, urgente:true }
  ],

  alojamientos: [
    { fechas:"18 jul",    nombre:"Hotel Mary",                 zona:"Mestre · Venecia" },
    { fechas:"19 jul",    nombre:"Brne Rooms",                 zona:"Postojna" },
    { fechas:"20 jul",    nombre:"Synergy Deluxe Apartments",  zona:"Sečovlje · Dragonja" },
    { fechas:"21 jul",    nombre:"Alojamiento en Tolmin",      zona:"Tolmin" },
    { fechas:"22–24 jul", nombre:"PONI NAKLO · Sobe Marinšek", zona:"Naklo" },
    { fechas:"25–27 jul", nombre:"Guest house Pr Ambružarju",  zona:"Cerklje na Gorenjskem" },
    { fechas:"28 jul",    nombre:"LH Hotel Sirio Venice",      zona:"Mestre · Venecia" }
  ],

  dias: [
    { f:"2026-07-18", xy:"45.490,12.240", dest:"Hotel Mary Mestre Venezia", t:"Llegada a Italia", arte:"venecia", base:"Hotel Mary · Mestre", paradas:[
      { h:"18:55", txt:"Vuelo Madrid → Venecia", key:true },
      { txt:"Check-in en el Hotel Mary", n:"Mestre" },
      { txt:"Free tour por Venecia", n:"Primer contacto con la ciudad" }
    ]},
    { f:"2026-07-19", xy:"45.780,14.210", dest:"Brne Rooms Postojna", t:"Cuevas y castillos", arte:"cueva", base:"Brne Rooms · Postojna", paradas:[
      { h:"15:00", txt:"Recogida del coche en Marco Polo", n:"Puerta 4 de llegadas → P5 → túnel blanco", key:true },
      { txt:"Cruce de frontera a Eslovenia" },
      { txt:"Cuevas de Škocjan", c:"Cuevas de Škocjan", n:"Patrimonio de la Humanidad · visita guiada con horarios fijos", mapa:"Škocjan Caves Slovenia", w:"Park Škocjanske jame", g:"skocjan" },
      { txt:"Castillo de Predjama", c:"Castillo de Predjama", n:"Incrustado en la pared de roca", mapa:"Predjama Castle", w:"Predjamski grad", g:"predjama" }
    ]},
    { f:"2026-07-20", xy:"45.480,13.620", dest:"Synergy Deluxe Apartments Sečovlje", t:"La costa eslovena", arte:"costa", base:"Synergy Deluxe Apartments · Sečovlje", paradas:[
      { txt:"Costa adriática eslovena" },
      { txt:"Pirán", c:"Pirán", n:"Aparcar en Fornače y subir en la lanzadera", mapa:"Parkirna hiša Fornače Piran", w:"Parkirna hiša Fornače Piran", key:true },
      { txt:"Cena en Okrepčevalnica Barka", mapa:"Okrepcevalnica Barka Slovenia", w:"Okrepčevalnica Barka Seča" }
    ]},
    { f:"2026-07-21", xy:"46.180,13.730", dest:"Tolmin Slovenia", t:"Valle del Soča", arte:"rio", base:"Tolmin", paradas:[
      { txt:"Subida desde la costa por el valle del Soča" },
      { txt:"Kanal ob Soči", c:"Kanal ob Soči", n:"Parada en el puente sobre el río", mapa:"Kanal ob Soci", w:"Kanal ob Soči", g:"soca" },
      { txt:"Gargantas de Tolmin", c:"Gargantas de Tolmin", n:"Ruta desde el aparcamiento P2", mapa:"Tolmin Gorges P2", w:"Tolminska korita", g:"tolmin", key:true },
      { txt:"Cascada Kozjak · Kobarid", c:"Cascada Kozjak", n:"Unos 20 min a pie desde el aparcamiento", mapa:"Slap Kozjak Kobarid", w:"Slap Kozjak Kobarid", g:"kozjak" }
    ]},
    { f:"2026-07-22", xy:"46.270,14.320", dest:"Sobe Marinšek Naklo", t:"El gran paso alpino", arte:"paso", base:"PONI NAKLO · Naklo", paradas:[
      { h:"Mañana", txt:"Paso de Vršič", c:"Paso de Vršič", n:"50 curvas de herradura · carretera lenta, calcula tiempo de sobra", mapa:"Vrsic Pass", w:"Prelaz Vršič", g:"vrsic", key:true },
      { h:"Tarde", txt:"Lago Jasna", c:"Lago Jasna", n:"Parada junto a Kranjska Gora", mapa:"Lake Jasna Kranjska Gora", w:"Jezero Jasna Kranjska Gora", g:"jasna" },
      { txt:"Reserva natural de Zelenci", c:"Zelenci", n:"Pasarelas sobre el manantial esmeralda", mapa:"Zelenci Nature Reserve", w:"Zelenci Kranjska Gora", g:"zelenci" },
      { txt:"Check-in en PONI NAKLO", n:"Sobe Marinšek · Naklo" }
    ]},
    { f:"2026-07-23", xy:"46.270,14.320", dest:"Sobe Marinšek Naklo", t:"El icónico lago Bled", arte:"bled",
      foto:{ src:"fotos/bled-osojnica.jpg", pie:"El lago Bled desde los miradores de Osojnica · 23 de julio" }, base:"PONI NAKLO · Naklo", paradas:[
      { h:"Mañana", txt:"Vuelta al lago Bled", c:"Mirador Ojstrica", n:"Subida al mirador de Ojstrica: 20 min de rampa y la foto de la isla", mapa:"Ojstrica viewpoint Bled", w:"Ojstrica Bled parkirišče", g:"bled", key:true },
      { txt:"Barca tradicional a la isla", c:"Embarcadero de Mlino", n:"La pletna, a remo. 99 escalones hasta la iglesia", mapa:"Bled Island", w:"Mlino Bled pletna" },
      { h:"Tarde", txt:"Garganta de Vintgar", c:"Garganta de Vintgar", n:"Pasarelas de madera sobre el río. Entrada con hora asignada", mapa:"Vintgar Gorge", w:"Soteska Vintgar", g:"vintgar", key:true },
      { txt:"Noche en Naklo" }
    ]},
    { f:"2026-07-24", xy:"46.270,14.320", dest:"Sobe Marinšek Naklo", t:"El salvaje lago Bohinj", arte:"bohinj", base:"PONI NAKLO · Naklo", paradas:[
      { h:"Mañana", txt:"Día en el lago Bohinj", c:"Lago Bohinj", park:{ n:"Bohinjska Bistrica (gratis)", w:"Bohinjska Bistrica železniška postaja", p:"Gratis + autobús. Junto al lago son 3–4 €/h", gratis:true }, n:"Caminata, kayak o la cascada Savica", mapa:"Lake Bohinj", w:"Bohinjsko jezero Ribčev Laz", g:"bohinj", key:true },
      { txt:"Cascada Savica", c:"Cascada Savica", n:"Unos 20 min de subida con escalones", mapa:"Slap Savica", w:"Slap Savica parkirišče", g:"savica" },
      { h:"Tarde", txt:"Teleférico de Vogel", c:"Teleférico de Vogel", n:"Vistas del Parque Nacional de Triglav desde arriba", mapa:"Vogel cable car", w:"Vogel žičnica", g:"vogel", key:true },
      { txt:"Noche en Naklo" }
    ]},
    { f:"2026-07-25", xy:"46.250,14.490", dest:"Pr Ambružarju Cerklje na Gorenjskem", t:"Peričnik y la capital", arte:"cascada", base:"Guest house Pr Ambružarju · Cerklje", paradas:[
      { h:"Mañana", txt:"Cascada de Peričnik", c:"Cascada Peričnik", park:{ n:"Koča pri Peričniku", w:"Koča pri Peričniku", p:"Unos 3 €/h. Varias fuentes dicen que es gratis antes de las 10:00", gratis:false }, n:"52 m de caída. Se camina por detrás de la cortina de agua: vais a acabar mojados", mapa:"Pericnik Waterfall", w:"Slap Peričnik", g:"pericnik", key:true },
      { txt:"Bajada a Liubliana", n:"Aparcad fuera del centro, es peatonal" },
      { h:"Comida", txt:"Centro histórico", c:"Centro de Liubliana", park:{ n:"P+R Ježica (1,50 € con bus)", w:"P+R Ježica Ljubljana", p:"1,50 € todo el día e incluye el bus de ida y vuelta. Se paga con tarjeta Urbana (2 €)", gratis:false }, n:"Puente de los Dragones y orillas del Ljubljanica", mapa:"Zmajski most Ljubljana", w:"Ljubljana center", g:"liubliana", key:true },
      { h:"Tarde", txt:"Castillo de Liubliana", c:"Castillo de Liubliana", n:"Funicular hasta arriba. Desde la torre se ve un tercio del país", mapa:"Ljubljana Castle", w:"Ljubljanski grad", g:"castillo-lj", key:true },
      { h:"Noche", txt:"Cena en las terrazas del río", n:"Y después a Cerklje, media hora de coche" },
      { txt:"Check-in en Pr Ambružarju", n:"Cerklje na Gorenjskem" }
    ]},
    { f:"2026-07-26", xy:"46.250,14.490", dest:"Pr Ambružarju Cerklje na Gorenjskem", t:"Valle de Logar y cascada Rinka", arte:"valle", base:"Guest house Pr Ambružarju · Cerklje", paradas:[
      { h:"Mañana", txt:"Valle de Logar", c:"Valle de Logar", park:{ n:"Antes de la barrera (gratis)", w:"Logarska dolina vstop", p:"Entrar en coche cuesta 10 €. A pie o en bici es gratis: hay aparcamiento antes de la entrada", gratis:true }, n:"Hora y cuarto desde Cerklje. Valle glaciar en U, de los más bonitos del país", mapa:"Logar Valley Slovenia", w:"Logarska dolina", g:"logar", key:true },
      { txt:"Entrada al valle", n:"Se paga por vehículo. La carretera llega hasta el fondo" },
      { h:"Mediodía", txt:"Cascada Rinka", c:"Cascada Rinka", n:"90 m. Mirador a 15 min a pie; hasta el pie, media hora larga", mapa:"Rinka Waterfall", w:"Slap Rinka", g:"rinka", key:true },
      { txt:"Picnic en el valle", n:"Comprad en el Mercator o el Hofer de camino: sale a mitad de precio" },
      { h:"Tarde", txt:"Vuelta tranquila a Cerklje" }
    ]},
    { f:"2026-07-27", xy:"46.250,14.490", dest:"Pr Ambružarju Cerklje na Gorenjskem", t:"Velika Planina y despedida", arte:"meseta", base:"Guest house Pr Ambružarju · Cerklje", paradas:[
      { h:"8:30–9:30", txt:"Subir en coche a Rakove Ravni", c:"Rakove Ravni", xy:"46.2856,14.6167",
        park:{ n:"Rakove Ravni (unos 10 €/día)", w:"Rakove Ravni parkirisce", p:"El aparcamiento grande de la meseta. Solo efectivo: el datáfono no siempre coge. En fin de semana se llena, de ahí lo de salir pronto." },
        n:"Desde Kamnik hacia Stahovica y desvío al collado de Kranjski Rak, dirección Luče. Luego pista forestal. Evita los 1.000 m de desnivel desde el valle y no depende del horario del teleférico",
        mapa:"Rakove Ravni parkirisce", w:"Rakove Ravni", g:"velika", key:true },
      { h:"Mañana", txt:"Subida a pie por el bosque", c:"Subida", n:"Hora y media o dos hasta el poblado. Abetos primero y de golpe se abren los pastos de Gojška y Mala Planina, con las primeras cabañas", g:"velika", key:true },
      { txt:"El poblado de pastores", n:"El más grande de Europa. En julio están arriba con las vacas. La capilla de Marija Snežna, con tejas de abeto", key:true },
      { txt:"Comer en un refugio", n:"Queso trnič, kislo mleko, jota o ricet. Zeleni Rob o las cabañas de Mala Planina. Efectivo" },
      { txt:"Bajada", n:"Por el mismo camino: hora y cuarto o hora y media. Las perras atadas, hay vacas sueltas" },
      { h:"Tarde", txt:"Škofja Loka si quedan ganas", c:"Škofja Loka", n:"Pueblo medieval, 40 min. Opcional", mapa:"Skofja Loka", w:"Škofja Loka", g:"skofja" },
      { txt:"Maletas y repostar", n:"El gasóleo es más barato aquí que en Italia" },
      { txt:"Noche en Cerklje" }
    ]},
    { f:"2026-07-28", xy:"45.490,12.240", dest:"LH Hotel Sirio Venice Mestre", t:"Retorno a los canales venecianos", arte:"canales", base:"LH Hotel Sirio Venice · Mestre", paradas:[
      { h:"Mañana", txt:"Vuelta a Italia por autopista", n:"Peajes italianos en cabina, se paga al salir" },
      { h:"15:00", txt:"Devolver el coche · Galdierirent", c:"Galdierirent", xy:"45.5052,12.3235",
        n:"Via Triestina 94, junto al aeropuerto. Abren de 8:00 a 22:00 · +39 342 013 8930. Fotos del coche y del cuentakilómetros antes de entregarlo, y pedid el informe de estado por escrito",
        mapa:"Via Triestina 94 Tessera Venezia", w:"Via Triestina 94 Venezia", g:"galdieri", key:true },
      { txt:"Bus 15 a Mestre", c:"Parada Tessera Triestina", n:"Pasa por la misma calle. Billete urbano ~1,50 € si subís en Tessera, no en el aeropuerto. Compradlo antes: en el quiosco de enfrente o en la app AVM Venezia", mapa:"Tessera Triestina fermata autobus Venezia", g:"galdieri", key:true },
      { h:"Tarde", txt:"Despedida por la isla de Venecia", c:"Venecia", n:"Plaza San Marcos, canales y cena", mapa:"Piazza San Marco Venezia", key:true },
      { txt:"Dejar cerrado el taxi de mañana", n:"Sale de madrugada: resérvalo esta noche", key:true }
    ]},
    { f:"2026-07-29", xy:"45.505,12.352", dest:"Aeroporto Marco Polo Venezia", t:"Madrugón y fin del viaje", arte:"avion", base:"—", paradas:[
      { h:"03:30", txt:"Taxi de Mestre al aeropuerto VCE", key:true },
      { h:"05:45", txt:"Vuelo Venecia → Madrid", n:"Wizz Air Malta · VJEL5V", key:true },
      { h:"10:00", txt:"Llegada y recogida del coche", n:"Parking de Barajas", key:true }
    ]}
  ],

  info: {
    emergencias:[
      ["Emergencias (SI e IT)","112"],
      ["Policía Eslovenia","113"],
      ["Rescate en montaña","112"],
      ["Emb. España en Liubliana","+386 1 620 01 30"]
    ],
    conducir:[
      ["Viñeta","Obligatoria en autopistas eslovenas. Semanal 16 €, mensual 32 €. En gasolinera o por la web oficial, eligiendo la fecha de inicio"],
      ["Luces","Cruce encendidas también de día. Es obligatorio"],
      ["Gasolineras","Cada 30 km más o menos. Precio parecido al de España"],
      ["Italia","Peaje en cabina, se paga al salir"],
      ["Alcohol","0,5 g/l · 0,0 para noveles"],
      ["Combustible","95 = bencin · gasóleo = dizel"]
    ],
    frases:[
      ["Dober dan","Buenos días"],
      ["Živjo","Hola (informal)"],
      ["Hvala","Gracias"],
      ["Prosim","Por favor / de nada"],
      ["Oprostite","Perdone"],
      ["Nasvidenje","Adiós"],
      ["Koliko stane?","¿Cuánto cuesta?"],
      ["Na zdravje!","¡Salud!"],
      ["Lekarna","Farmacia"],
      ["Voda","Agua"]
    ],
    practico:[
      ["Moneda","Euro en Eslovenia e Italia"],
      ["Precios","Punto medio: ni Suiza ni el este barato. Parecidos a España, más altos en Bled"],
      ["Comer","Menús del día de 10 a 12 € fuera de las plazas principales. Raciones enormes"],
      ["Entradas","De 15 a 30 € por persona en cuevas y castillos grandes"],
      ["Truco","Compra en Mercator o Hofer y haz picnic frente a un lago"],
      ["Tasa turística","De 2 a 3 € por persona y noche, aparte del alojamiento"],
      ["Enchufes","Tipo C/F, 230 V — igual que en España"],
      ["Agua","Del grifo potable en todo el país"],
      ["Propina","No obligatoria, se redondea o ~10%"],
      ["Montaña","El tiempo cambia rápido: chubasquero siempre en la mochila"]
    ]
  }
};


/* =========================================================
   GUÍA DE LUGARES — información recopilada del viaje
   ========================================================= */
const GUIA = [
  { zona:"Alpes Julianos", wl:["Bled","Bohinj","Vintgar","Triglav"], arte:"bled", nota:"La postal eslovena: picos, lagos glaciares y el parque nacional más salvaje del país.", lugares:[
    { id:"bled", xy:"46.368,14.114", n:"Lago Bled", d:"2026-07-23",
      t:"El más conocido y el más turístico, y aun así merece la pena. Una isla en mitad del agua con una iglesia encima, y montañas de fondo. La foto clásica sale del mirador de Ojstrica; a la isla se va en pletna, la barca de remo tradicional, y hay 99 escalones hasta arriba.",
      k:[["Mirador Ojstrica","20 min de subida"],["Isla","99 escalones"]], m:"Lake Bled Slovenia" },
    { id:"castillo-bled", xy:"46.369,14.101", n:"Castillo de Bled",
      t:"Lo mejor no es el interior sino lo que se ve desde él. Dentro se puede comer y catar vinos eslovenos.",
      m:"Bled Castle" },
    { id:"vintgar", xy:"46.393,14.058", n:"Garganta de Vintgar", d:"2026-07-23",
      t:"Pasarelas y puentes de madera clavados en la roca sobre el río Radovna, entre paredes muy estrechas. De los sitios más bonitos del país. La entrada lleva hora asignada, así que conviene reservar.",
      k:[["Río","Radovna"],["Entrada","con hora asignada"]], m:"Vintgar Gorge" },
    { id:"bohinj", xy:"46.283,13.878", n:"Lago Bohinj", d:"2026-07-24",
      t:"El lago más grande de Eslovenia y mucho más silvestre que Bled. En julio te puedes bañar. Desde aquí salen la cascada Savica y las rutas a los montes de alrededor.",
      k:[["Tamaño","el mayor del país"],["Baño","sí, en verano"]], m:"Lake Bohinj" },
    { id:"savica", xy:"46.293,13.799", n:"Cascada Savica", d:"2026-07-24",
      t:"Una de las más pintorescas: la corriente se parte en dos ramas dentro de un subterráneo oculto antes de salir a la luz.",
      m:"Slap Savica" },
    { id:"pericnik", xy:"46.446,13.945", n:"Cascada de Peričnik", d:"2026-07-25",
      t:"De las más altas e icónicas del país. Tiene dos saltos y se puede caminar por detrás de la cortina de agua del primero, que es lo que la hace especial. Vais a salir mojados.",
      k:[["Salto principal","52 m"],["Segundo salto","16 m"]], m:"Pericnik Waterfall" },
    { id:"vogel", xy:"46.263,13.840", n:"Teleférico de Vogel", d:"2026-07-24",
      t:"Sube desde Bohinj hasta un balcón sobre el Parque Nacional de Triglav. Es la forma rápida de ver la alta montaña sin caminar seis horas.",
      m:"Vogel cable car" },
    { id:"triglav", xy:"46.378,13.837", n:"Lagos de Triglav",
      t:"También llamado el Valle de los Siete Lagos. Hay siete permanentes y algunos intermitentes, así que el paisaje cambia según cuándo vayas. Es excursión de día completo.",
      k:[["Lagos","7 permanentes"]], m:"Triglav Lakes Valley" },
    { id:"mostnica", xy:"46.300,13.900", n:"Garganta de Mostnica",
      t:"Atraviesa un bosque precioso. Es conocida por una roca a la que llaman el Elefante por su parecido. Se puede hacer circular recorriendo los dos lados del río.",
      m:"Mostnica Gorge" }
  ]},

  { zona:"Valle del Soča", wl:["Tolmin","Bovec","Kobarid","Vršič"], arte:"rio", nota:"La zona más salvaje y aventurera: el río más esmeralda de Europa, gargantas imposibles y cascadas escondidas.", lugares:[
    { id:"soca", xy:"46.300,13.600", n:"Garganta del río Soča", d:"2026-07-21",
      t:"El color del agua es lo primero que te descoloca: un turquesa que no parece real. Se puede recorrer a pie, hacer rafting y darse un baño, aunque el agua está helada.",
      m:"Soca Gorge Slovenia" },
    { id:"tolmin", xy:"46.200,13.750", n:"Garganta de Tolmin", d:"2026-07-21",
      t:"La ruta pasa bajo un puente natural formado por una roca que cayó y se quedó encajada entre las paredes del desfiladero. Debajo del llamado puente del Diablo hay un manantial termal metido en una cueva.",
      k:[["Aparcamiento","P2"],["Curiosidad","manantial termal en cueva"]], m:"Tolmin Gorges" },
    { id:"kozjak", xy:"46.260,13.580", n:"Cascada Kozjak", d:"2026-07-21",
      t:"Cae dentro de un anfiteatro de roca y forma una balsa turquesa que parece de película de fantasía. Es de las más fotogénicas del país.",
      m:"Slap Kozjak Kobarid" },
    { id:"boka", xy:"46.320,13.510", n:"Cascada Boka",
      t:"La cascada más alta de Eslovenia. No te puedes acercar a ella, pero se ve desde la carretera y aun así impresiona.",
      k:[["Récord","la más alta del país"]], m:"Boka Waterfall" },
    { id:"vrsic", xy:"46.433,13.747", n:"Paso de Vršič", d:"2026-07-22",
      t:"El puerto de montaña más alto del país. Cincuenta curvas de herradura, muchas de ellas adoquinadas, cruzando el corazón de los Alpes Julianos.",
      k:[["Curvas","50 de herradura"]], m:"Vrsic Pass" },
    { id:"jasna", xy:"46.475,13.775", n:"Lago Jasna", d:"2026-07-22",
      t:"Muy cerca del paso, junto a Kranjska Gora. Son dos lagos artificiales conectados que se recorren en un rato, con los Alpes de fondo.",
      m:"Lake Jasna Kranjska Gora" },
    { id:"zelenci", xy:"46.494,13.727", n:"Reserva natural de Zelenci", d:"2026-07-22",
      t:"Pasarelas de madera sobre un manantial de un verde esmeralda intenso. Es el nacimiento del río Sava Dolinka.",
      m:"Zelenci Nature Reserve" }
  ]},

  { zona:"Cuevas y sur", wl:["Škocjan","Postojna","Cerknica"], arte:"cueva", nota:"Hay unas 14.000 cuevas bajo el país, como un queso gruyère. Solo 22 se pueden visitar.", lugares:[
    { id:"skocjan", xy:"45.664,13.991", n:"Cuevas de Škocjan", d:"2026-07-19",
      t:"Patrimonio de la Humanidad. Se descubrieron en 1885 mientras buscaban de dónde sacar agua potable para Trieste, y desde entonces se han ido explorando más galerías. Junto con Postojna son las dos imprescindibles, y se complementan porque son muy distintas.",
      k:[["Descubiertas","1885"],["UNESCO","sí"]], m:"Skocjan Caves" },
    { id:"postojna", xy:"45.783,14.203", n:"Cuevas de Postojna",
      t:"Las más largas y visitadas de Europa, y de las mayores del mundo. Miden unos 24 km, de los que se recorren cerca de 5, parte en un tren subterráneo.",
      k:[["Longitud","24 km"],["Recorrido","unos 5 km"]], m:"Postojna Cave" },
    { id:"predjama", xy:"45.816,14.128", n:"Castillo de Predjama", d:"2026-07-19",
      t:"Ochocientos años encajado dentro de la boca de una cueva. Naturaleza y mano humana hicieron una fortaleza imposible de tomar, con su historia y su leyenda. La cueva de debajo es prescindible si ya ves Postojna y Škocjan.",
      k:[["Antigüedad","unos 800 años"]], m:"Predjama Castle" },
    { id:"krizna", xy:"45.745,14.440", n:"Krizna Cave y Planina Cave",
      t:"Más pequeñas y menos conocidas, pero con lagos subterráneos navegables. Otra forma de ver el mundo de debajo.",
      m:"Krizna Cave Slovenia" },
    { id:"cerknica", xy:"45.750,14.360", n:"Lago Cerknica",
      t:"Un lago que desaparece en verano y vuelve a aparecer. Es de los lagos intermitentes más grandes de Europa. Se recorre a pie, en bici o en canoa, y tiene centro de visitantes.",
      k:[["Rareza","intermitente"]], m:"Lake Cerknica" },
    { id:"sneznik", xy:"45.650,14.420", n:"Castillo de Sneznik",
      t:"Conserva los interiores originales y está en un paraje con árboles y un estanque con patos donde se refleja el edificio. Prescindible si vas justo de tiempo.",
      m:"Sneznik Castle" }
  ]},

  { zona:"Liubliana y centro", wl:["Ljubljana","Velika planina","Škofja Loka"], arte:"medieval", nota:"El corazón verde de un país muy verde. Capital verde europea en 2016.", lugares:[
    { id:"venecia", xy:"45.434,12.339", n:"Venecia", d:"2026-07-28",
      civ:"https://www.civitatis.com/es/venecia/",
      t:"El principio y el final del viaje. La primera noche hicisteis free tour, y la última tarde queda el paseo de despedida por la isla: San Marcos, los canales y la cena. Desde Mestre se llega en tren en poco más de diez minutos.",
      k:[["Desde Mestre","10–15 min en tren"]], m:"Piazza San Marco Venezia" },
    { id:"liubliana", civ:"https://www.civitatis.com/es/liubliana/", xy:"46.051,14.506", n:"Liubliana", d:"2026-07-25",
      t:"Ciudad pequeña y con mucho encanto, de centro histórico compacto y peatonal. Catedral, iglesia franciscana de la Anunciación, edificios barrocos de aire italiano y el Puente de los Dragones. Se recorre andando sin esfuerzo.",
      k:[["Capital verde europea","2016"]], m:"Ljubljana old town" },
    { id:"castillo-lj", xy:"46.049,14.508", n:"Castillo de Liubliana", d:"2026-07-25",
      t:"Se sube en funicular. Desde la torre panorámica, a unos 400 m de altitud, dicen que se llega a ver un tercio del país.",
      k:[["Altitud","unos 400 m"],["Acceso","funicular"]], m:"Ljubljana Castle" },
    { id:"velika", xy:"46.300,14.630", n:"Velika Planina", d:"2026-07-27",
      t:"El poblado de pastores más grande de Europa, en una meseta alpina de pastos altos. Entre junio y septiembre los pastores viven arriba con el ganado, hacen queso y se oyen los cencerros por toda la meseta. Las cabañas son de madera con planta elíptica, los <i>cimpri</i>, y en el poblado principal está la capilla de Marija Snežna: la destruyeron en la Segunda Guerra Mundial y la reconstruyeron con las tejas de abeto típicas de aquí.\n\nHay dos maneras de subir. En teleférico desde el valle, o <b>en coche hasta la propia meseta</b>, que es la que os interesa con las perras y la que evita los más de mil metros de desnivel desde abajo. Desde Kamnik se va hacia Stahovica y se toma el desvío que sube al collado de Kranjski Rak, dirección Luče. Desde el collado, pista forestal acondicionada hasta los aparcamientos.\n\nDe los tres aparcamientos, <b>Rakove Ravni</b> es el más amplio y el que deja el paseo completo: bosque de abetos primero, y luego se abre de golpe a los pastos de Gojška Planina y Mala Planina. Sube en hora y media o dos, baja en hora y cuarto. Si queréis acortar, Ušivec quita media hora y Mačkin Kot deja la ruta en cuarenta minutos de subida.",
      k:[["Temporada de pastores","junio a septiembre"],
         ["Subida a pie desde Rakove Ravni","1 h 30 – 2 h"],
         ["Bajada","1 h 15 – 1 h 30"],
         ["Distancia ida y vuelta","10–12 km"],
         ["Desnivel","+450 a +500 m"],
         ["Dificultad","moderada, sin dificultad técnica"],
         ["Aparcamiento","unos 10 €/día · solo efectivo"],
         ["Acceso","en coche hasta la meseta, o teleférico"]],
      c:"Salid entre las 8:30 y las 9:30. Es cuando hay sitio en Rakove Ravni en fin de semana, y evitáis las tormentas de tarde, que en alta montaña son de manual. Llevad efectivo: ni el aparcamiento ni los refugios se fían del datáfono, la cobertura falla. Calzado con suela agarrando, que hay hierba, piedra y barro si ha llovido, y un cortavientos aunque salga sol. Las perras, atadas: hay vacas sueltas pastando toda la meseta.",
      wl:["Velika Planina"], m:"Rakove Ravni parkirisce" },
    { id:"rakove", xy:"46.2856,14.6167", n:"Rakove Ravni (aparcamiento)", d:"2026-07-27",
      t:"El aparcamiento grande de Velika Planina, el que deja el recorrido completo. Explanada amplia, paneles informativos y punto de control. Desde aquí la subida es de hora y media a dos horas, y la bajada de hora y cuarto.",
      k:[["Precio","unos 10 €/día"],["Pago","efectivo, el datáfono falla"],["Desnivel desde aquí","~500 m"]],
      m:"Rakove Ravni parkirisce" },
    { id:"usivec", xy:"46.2921,14.6248", n:"Ušivec (aparcamiento)", d:"2026-07-27",
      t:"Un poco más adelante por la pista. Ahorra entre quince y treinta minutos de caminata y da acceso más directo a Mala Planina. Subida de una hora a una hora y veinte.",
      k:[["Desnivel desde aquí","~300 m"],["Subida","1 h – 1 h 20"]],
      m:"Usivec Velika Planina" },
    { id:"skofja", xy:"46.166,14.306", n:"Škofja Loka", d:"2026-07-27",
      t:"Villa medieval de las mejor conservadas de Eslovenia, a un rato corto de Liubliana.",
      m:"Skofja Loka" },
    { id:"galdieri", xy:"45.5052,12.3235", n:"Devolución del coche · Galdierirent", d:"2026-07-28",
      t:"Donde se devuelve el Fiat Panda el día 28 a las tres. Via Triestina 94, en Tessera, pegado al aeropuerto Marco Polo. Abren de ocho de la mañana a diez de la noche, así que hay margen si la vuelta desde Eslovenia se alarga.\n\n<b>El autobús 15 de ACTV pasa por esta misma calle</b> y va hasta la estación de Mestre. Y aquí está lo bueno: el recargo de 8 € del aeropuerto solo se aplica si subes o bajas en la parada de la terminal. En la parada de <b>Tessera, Triestina</b>, que es la que tenéis al lado, se paga la tarifa urbana normal, alrededor de 1,50 €. Devolvéis el coche, cruzáis a la parada y os plantáis en Mestre por menos de lo que cuesta un café.\n\nEl otro camino, ir andando a la terminal para coger el ATVO rápido, <b>no lo hagáis</b>: son 1,2 o 1,5 km por una carretera con mucho tráfico y tramos sin acera. Con maletas, mala idea.",
      k:[["Dirección","Via Triestina 94, Tessera"],
         ["Horario","8:00 – 22:00"],
         ["Teléfono","+39 342 013 8930"],
         ["Bus al hotel","línea 15 de ACTV"],
         ["Parada","Tessera, Triestina"],
         ["Billete","~1,50 € · comprar antes de subir"],
         ["Al hotel de Mestre","unos 8 km"]],
      c:"El billete <b>hay que llevarlo comprado</b>: en el autobús no se vende. Hay un quiosco a unos 50 metros de la parada, en el sentido contrario, o se compra desde la app AVM Venezia. Y validadlo al subir, en la maquinita amarilla. Antes de entregar el coche: fotos por los cuatro lados, del cuentakilómetros y del nivel de combustible, que es lleno-lleno. Pedid el informe de estado por escrito: la fianza son 600 €.",
      tel:"+393420138930",
      rutas:[["Ver el 15 ahora","transit","LH Hotel Sirio Venice Mestre"],
             ["La parada, en el mapa","walking","Tessera Triestina fermata autobus Venezia"]],
      m:"Via Triestina 94 Tessera Venezia" },
    { id:"tivoli", xy:"46.055,14.494", n:"Parque Tivoli",
      t:"El gran parque de Liubliana, pegado al centro. Buen sitio para el último paseo tranquilo antes de irse.",
      m:"Tivoli Park Ljubljana" }
  ]},

  { zona:"Este y Valle de Logar", wl:["Logarska dolina","Solčava","Celje"], arte:"valle", nota:"Paisajes alpinos brutales y tranquilidad absoluta, a un par de horas de la capital.", lugares:[
    { id:"logar", xy:"46.395,14.600", n:"Valle de Logar", d:"2026-07-26",
      t:"Valle glaciar en forma de U, uno de los tres valles de la zona. Es el destino perfecto si buscas montaña grande sin las colas de Bled. Se entra en coche pagando por vehículo y la carretera llega hasta el fondo.",
      k:[["Desde Cerklje","hora y cuarto"],["Entrada","por vehículo"]], m:"Logar Valley Slovenia" },
    { id:"rinka", xy:"46.383,14.600", n:"Cascada Rinka", d:"2026-07-26",
      t:"Noventa metros de caída al fondo del Valle de Logar, de las más altas del país. Hay un mirador a quince minutos a pie y se puede seguir hasta el pie del salto.",
      k:[["Altura","90 m"],["Mirador","15 min a pie"]], m:"Rinka Waterfall" },
    { id:"celje", xy:"46.231,15.267", n:"Celje",
      t:"La tercera ciudad del país, la de los Condes de Celje. Llena de historia: restos de calzada romana, torres medievales y un buen conjunto de plazas y edificios.",
      m:"Celje Slovenia" },
    { id:"castillo-celje", xy:"46.220,15.270", n:"Castillo de Celje",
      t:"La fortaleza medieval más antigua de Eslovenia y el castillo más grande. Las vistas desde la muralla son de las mejores del país.",
      k:[["Récord","el mayor castillo del país"]], m:"Celje Castle" },
    { id:"ptuj", xy:"46.420,15.870", n:"Ptuj",
      t:"La ciudad más antigua de Eslovenia, con historia que se remonta a la Edad de Piedra y muchos edificios protegidos. Su carnaval es el más importante del país: el desfile del Kurent es Patrimonio Cultural Inmaterial de la UNESCO.",
      k:[["Carnaval","Kurenti · UNESCO"]], m:"Ptuj Slovenia" },
    { id:"sumik", xy:"46.450,15.420", n:"Cascadas Veliki y Mali Šumik",
      t:"Dos cascadas metidas entre bosques. La caminata es algo exigente, pero compensa.",
      m:"Veliki Sumik waterfall" }
  ]},

  { zona:"Comer, beber y ver bichos", arte:"meseta", nota:"Lo que no sale en el itinerario pero acaba siendo la mitad del viaje.", lugares:[
    { id:"vinos", n:"Eslovenia, tierra de vinos",
      t:"Tres regiones vinícolas, cada una con sus cepas según suelo, clima y forma de elaborar. Se cultivan 52 variedades de vid. En los Decanter World Wine Awards de 2022 el país se llevó siete oros, setenta platas y ciento dieciocho bronces. Brda, junto a la frontera italiana, es la zona más fotogénica para catar.",
      k:[["Regiones","3"],["Variedades","52"]], m:"Brda wine region Slovenia" },
    { id:"osos", xy:"43.050,-6.200", n:"Observación de osos",
      t:"El 60% del país es bosque, y los más extensos están en el sur. Ahí viven entre 900 y 1.000 osos pardos, la mayor densidad del mundo, sobre todo en los bosques de Kočevje. Hay tours de observación desde escondites con ventana.",
      k:[["Osos","900–1.000"],["Zona","Kočevje"]], m:"Kocevje Slovenia" },
    { id:"comer", n:"Comer sin arruinarse",
      t:"Los precios se parecen a los de España, un poco más bajos en algunas cosas y más altos en las zonas turísticas como Bled. Fuera de las plazas principales hay menús del día muy buenos por 10 o 12 euros, y las raciones son enormes. El truco que repite todo el mundo: comprar en Mercator o Hofer y hacer picnic frente a un lago.",
      k:[["Menú del día","10–12 €"],["Entradas","15–30 € por persona"]] }
  ]}
];

const LUGARES = {};
GUIA.forEach(z => z.lugares.forEach(l => { LUGARES[l.id] = l; l.zona = z.zona; }));
