/* ═══════════════════════════════════════════════════════════
   Asturias occidental · los datos del viaje

   Aquí está el viaje entero y nada más: días, paradas, guía de
   lugares e información práctica. La app (index.html) pone la
   estructura y assets/app.js el motor.

   Se carga antes que el resto para que el motor lo encuentre ya
   definido. Va sin ?v=: la versión la lleva asturias/sw.js, y si
   se toca este archivo hay que subir su CACHE o el móvil seguirá
   con los datos viejos.
   ═══════════════════════════════════════════════════════════ */

const VIAJE = {
  nombre: "Asturias occidental",
  salida: "San Miguel de las Dueñas",
  dias: [
    { d:1, xy:"43.090,-6.250", t:"Subida a Somiedo", arte:"puerto", base:"Zona alta de Somiedo", km:"150 km · 2 h 30",
      dest:"Pola de Somiedo", paradas:[
      { h:"Mañana", txt:"San Miguel → Villablino → Puerto de Somiedo", c:"Pola de Somiedo",
        n:"Por la CL-631 y la AS-227. Carretera de puerto, sin prisa", mapa:"Pola de Somiedo", key:true },
      { txt:"Centro de Interpretación del Parque", c:"Centro del Parque",
        n:"En Pola. Merece la parada: informan de qué zonas están saturadas y del estado de las pistas",
        mapa:"Centro Interpretación Parque Natural Somiedo Pola", g:"centro" },
      { h:"Tarde", txt:"Valle de Saliencia", c:"Valle de Saliencia",
        n:"Subida suave viendo cabañas de teito. Reconocimiento del terreno para mañana",
        mapa:"Valle de Saliencia Somiedo", g:"teitos", key:true },
      { txt:"Buscar sitio para dormir", n:"Zona de La Farrapona o Valle de Lago. Cuanto más arriba, más fresco" }
    ]},

    { d:2, xy:"43.090,-6.250", t:"Lagos de Saliencia", arte:"lagos", base:"Somiedo", km:"25 km + ruta a pie",
      dest:"Pola de Somiedo", paradas:[
      { h:"Antes de las 9", txt:"Alto de La Farrapona", c:"Alto de La Farrapona",
        n:"1.708 m, el puerto asfaltado más alto de Asturias. Aquí empieza la ruta",
        mapa:"Alto de la Farrapona Somiedo", w:"Alto de la Farrapona", g:"saliencia", key:true,
        park:{ n:"La Farrapona (gratis)", w:"Alto de la Farrapona aparcamiento",
               p:"Gratuito pero pequeño. En agosto se llena antes de las 9:00 y en las cunetas multan", gratis:true } },
      { txt:"Ruta de los lagos", c:"Ruta de los lagos",
        n:"Lago de la Cueva, Cerveiriz y Calabazosa. De 8 a 11 km según hasta dónde lleguéis",
        wl:"lagos de saliencia somiedo", g:"saliencia", key:true },
      { h:"Tarde", txt:"Valle de Lago", c:"Valle de Lago",
        n:"Pueblo de montaña con aparcamiento pequeño a la entrada. Si queda cuerpo, pista llana al Lago del Valle",
        mapa:"Valle de Lago Somiedo", wl:"lago del valle somiedo", g:"lagodelvalle" },
      { txt:"Cena en Pola de Somiedo", n:"O en la furgo, que después de once kilómetros apetece poco bajar" }
    ]},

    { d:3, xy:"43.562,-6.146", t:"De la montaña al mar", arte:"costa", base:"Zona de Cudillero", km:"110 km · 1 h 45",
      dest:"Cudillero", paradas:[
      { h:"Mañana", txt:"Braña de La Pornacal", c:"La Pornacal",
        n:"Desde Villar de Vildas. Treinta y tantas cabañas de teito juntas, la braña mejor conservada del parque. Unos 7 km ida y vuelta",
        mapa:"Villar de Vildas Somiedo", wl:"la pornacal villar de vildas", g:"pornacal", key:true },
      { txt:"Bajada por Belmonte y Salas", n:"Se acaba la montaña y empieza el verde de valle" },
      { h:"Tarde", txt:"Cabo Vidio", c:"Cabo Vidio",
        n:"Faro y acantilado. De los mejores atardeceres de la costa occidental",
        mapa:"Cabo Vidio Asturias", g:"vidio" },
      { txt:"Playa del Silencio", c:"Playa del Silencio",
        n:"Se aparca arriba en Castañeras y se baja andando. Es de cantos, no de arena",
        mapa:"Playa del Silencio Castañeras", w:"Castañeras Cudillero", g:"silencio", key:true,
        park:{ n:"Castañeras (gratis)", w:"Castañeras aparcamiento playa del Silencio",
               p:"Aparcamiento de tierra arriba del pueblo. No se puede bajar en coche", gratis:true } },
      { txt:"Noche por la zona de Cudillero" }
    ]},

    { d:4, xy:"43.220,-6.870", t:"Costa occidental", arte:"puerto-mar", base:"Zona de Grandas o Navia", km:"120 km · 2 h",
      dest:"Grandas de Salime", paradas:[
      { h:"Mañana", txt:"Cudillero", c:"Cudillero",
        n:"El anfiteatro de casas de colores sobre el puerto. Aparcad arriba: abajo es imposible",
        mapa:"Cudillero puerto", g:"cudillero", key:true,
        park:{ n:"Aparcamientos de arriba", w:"Cudillero aparcamiento alto",
               p:"El casco es un embudo. Se deja el coche arriba y se baja andando", gratis:false } },
      { txt:"Cabo Busto", n:"Acantilados y molinos. Parada corta de camino", mapa:"Cabo Busto Asturias" },
      { h:"Mediodía", txt:"Luarca", c:"Luarca",
        n:"La villa blanca. Puerto, faro y el cementerio sobre el mar, que es de los más bonitos de España",
        mapa:"Luarca faro cementerio", g:"luarca", key:true },
      { txt:"Playa de Barayo", c:"Playa de Barayo",
        n:"Reserva natural con dunas y ría. Se llega andando y por eso está tranquila",
        mapa:"Playa de Barayo Navia", wl:"playa de barayo", g:"barayo" },
      { h:"Tarde", txt:"Castro de Coaña", c:"Castro de Coaña",
        n:"Poblado castreño de los mejor conservados del norte", mapa:"Castro de Coaña", g:"coana" },
      { txt:"Subida a Grandas de Salime", c:"Grandas de Salime",
        n:"Por el embalse. La carretera es larga pero espectacular",
        mapa:"Grandas de Salime", g:"salime", key:true }
    ]},

    { d:5, xy:"42.580,-6.500", t:"Vuelta por la montaña", arte:"vuelta", base:"Casa", km:"190 km · 3 h 30",
      dest:"San Miguel de las Dueñas", paradas:[
      { h:"Mañana", txt:"Museo Etnográfico de Grandas", c:"Museo de Grandas",
        n:"Si abre el día que vais, es de los mejores museos etnográficos del país",
        mapa:"Museo Etnográfico Grandas de Salime", g:"museo" },
      { txt:"Puerto del Connio y Rañadoiro", c:"Puerto del Rañadoiro",
        n:"Carretera de montaña preciosa y vacía. Repostad antes: aquí no hay gasolineras",
        mapa:"Puerto del Rañadoiro", key:true },
      { h:"Mediodía", txt:"Cangas del Narcea", c:"Cangas del Narcea",
        n:"Última parada asturiana. Gasolina, comida y vino de la tierra", mapa:"Cangas del Narcea" },
      { txt:"Puerto de Leitariegos", c:"Leitariegos",
        n:"Se cruza a León por lo alto", mapa:"Puerto de Leitariegos", key:true },
      { txt:"Villablino → San Miguel de las Dueñas", c:"Casa", mapa:"San Miguel de las Dueñas" }
    ]}
  ],

  guia: [
    { zona:"Somiedo", wl:["Somiedo","Saliencia","Valle de Lago","Villar de Vildas"], arte:"lagos", nota:"Parque Natural desde 1988 y Reserva de la Biosfera desde 2000. Cinco valles glaciares, una docena de lagos y la mayor población de oso pardo de la cordillera Cantábrica.", lugares:[

      { id:"parque", xy:"43.090,-6.250", n:"El parque, en general",
        t:"Somiedo son cinco valles que bajan en paralelo desde la divisoria con León: Saliencia, Valle, Pigüeña, Somiedo y Perlunes. Esa estructura explica el viaje: no se recorre en círculo, se entra y se sale de cada valle desde el eje de la AS-227.¶Es uno de los pocos sitios de la península donde la actividad ganadera de montaña sigue viva de verdad, no como decorado. En julio y agosto hay ganado en los pastos altos y gente trabajando en las brañas, y eso condiciona lo que os vais a encontrar: pistas con vacas, perros de rebaño y cierres que hay que dejar como estaban.",
        k:[["Superficie","unas 29.000 ha"],["Valles","5"],["Altitud","400 a 2.100 m"]],
        tip:"El Centro de Interpretación de Pola no es un trámite: allí saben qué aparcamiento está lleno hoy y qué pista está cortada.",
        m:"Parque Natural de Somiedo" },

      { id:"saliencia", xy:"43.058,-6.094", n:"Lagos de Saliencia", d:2,
        t:"Tres lagos glaciares escalonados por encima de los 1.600 metros. El primero, el Lago de la Cueva, aparece a los veinte minutos y es el más accesible. Después vienen Cerveiriz y, algo más arriba, Calabazosa, al que muchos llaman Lago Negro por el color que le da la profundidad. Hay un cuarto, Almagrera, que en verano se queda casi seco.¶La ruta sale del Alto de La Farrapona por pista ancha y cómoda, sin trepadas ni pasos expuestos. La dificultad no está en el terreno: está en la altitud, en el sol y en que no hay una sola sombra en todo el recorrido. En agosto, a mediodía, el reflejo en la roca caliza es duro para las perras.¶Se puede alargar bajando desde Cerveiriz hasta el Lago del Valle y saliendo por el pueblo de Valle de Lago, pero eso obliga a dejar dos coches o a volver por donde vinisteis.",
        k:[["Distancia","8 a 11 km"],["Desnivel","moderado"],["Altitud","1.600–1.700 m"],["Sombra","ninguna"]],
        tip:"Salid del aparcamiento antes de las 9:30. A partir de las once el sendero es una fila india y la roca ya quema.",
        m:"Alto de la Farrapona Somiedo", wl:"lagos de saliencia" },

      { id:"lagodelvalle", xy:"43.020,-6.190", n:"Lago del Valle", d:2,
        t:"Veinticuatro hectáreas de agua: el lago natural más grande de toda la cordillera Cantábrica. Está metido en un circo glaciar al fondo de su propio valle, y se llega por una pista llana y ancha desde el pueblo de Valle de Lago, unos seis kilómetros y medio en cada sentido.¶Es la ruta más agradecida del viaje si Bella y Lisboa van justas de fuelle o si el día viene caluroso: casi no hay desnivel, el firme es bueno y hay tramos con sombra y agua corriendo al lado. Se puede hacer también en bici.",
        k:[["Distancia","13 km i/v"],["Desnivel","poco"],["Firme","pista ancha"],["Tamaño","24 hectáreas"]],
        tip:"Es la alternativa perfecta si La Farrapona os pilla el aparcamiento lleno. Mismo paisaje, otra puerta de entrada.",
        m:"Valle de Lago Somiedo", wl:"lago del valle" },

      { id:"pornacal", xy:"43.080,-6.360", n:"Braña de La Pornacal", d:3,
        t:"La braña de teitos mejor conservada de Somiedo y probablemente de Asturias: más de treinta cabañas de piedra con cubierta vegetal, agrupadas en la ladera sobre el valle del Pigüeña. Se sube desde Villar de Vildas por un camino empedrado en buena parte, con desnivel constante pero sin dificultad.¶Lo que la hace distinta de otras brañas es la concentración: no son tres cabañas sueltas, es un poblado entero. Y sigue teniendo uso ganadero, así que lo normal es cruzarse con vacas y con quien sube a atenderlas.",
        k:[["Distancia","7 km i/v"],["Desde","Villar de Vildas"],["Cabañas","más de 30"]],
        tip:"El camino es de piedra suelta en algún tramo. Con perras, calzado y calma en la bajada.",
        m:"Villar de Vildas Somiedo", wl:"la pornacal" },

      { id:"teitos", xy:"43.060,-6.150", n:"Brañas y cabañas de teito", d:1,
        t:"El teito es una cubierta vegetal de escoba, un arbusto de la zona, montada sobre una estructura de madera y muros de piedra sin argamasa. Aguanta décadas si se mantiene, y se pudre en pocos años si se abandona. Por eso quedan tantas ruinas al lado de las que siguen en pie.¶Las brañas son los conjuntos de cabañas en los pastos altos, donde el ganado sube en verano. Las hay de dos tipos: las de alzada, que se ocupaban solo en la temporada alta, y las equidistantes, más cerca del pueblo. En el valle de Saliencia se ven desde la propia carretera sin bajarse del coche.",
        k:[["Material","piedra y escoba"],["Uso","pastos de verano"]],
        m:"Valle de Saliencia Somiedo" },

      { id:"vaqueiros", xy:"43.090,-6.250", n:"Vaqueiros de alzada",
        t:"El grupo humano que dio forma a este paisaje: ganaderos trashumantes del occidente asturiano que subían con el ganado a las brañas en verano y bajaban a los valles en invierno, moviendo la casa entera con ellos.¶Fueron durante siglos una comunidad marginada, con iglesias donde tenían banco aparte y matrimonios de puertas adentro. Hoy queda la arquitectura, la toponimia y las fiestas, y una historia bastante más áspera que la que cuentan los folletos.",
        m:"Museo Etnográfico Grandas de Salime" },

      { id:"osos", xy:"43.050,-6.200", n:"Osos pardos",
        t:"La población cantábrica de oso pardo llegó a estar al borde de la extinción y hoy se ha recuperado hasta las varias centenas de ejemplares, con Somiedo como uno de sus núcleos. Verlos es posible, pero no es un safari: hace falta prismáticos, madrugar o esperar al atardecer, y quedarse quieto en un mirador mirando laderas durante un buen rato.¶Los puntos habituales son los miradores del entorno de Valle de Lago y de La Peral. En agosto la mejor hora es la primera del día, antes de que suba la gente y el calor.",
        k:[["Mejor hora","amanecer y atardecer"],["Necesario","prismáticos y paciencia"]],
        tip:"Con perras la probabilidad baja mucho: el oso las huele antes de que vosotros lo veáis. Si os interesa de verdad, id sin ellas.",
        m:"Mirador de La Peral Somiedo" },

      { id:"puertosomiedo", xy:"43.020,-6.140", n:"Puerto de Somiedo", d:1,
        t:"El paso desde León, a casi 1.500 metros. La subida desde el lado leonés es larga y la bajada hacia Pola es de curvas cerradas con paredes de roca. En agosto no tiene ningún problema, pero es carretera lenta: contad bastante más de lo que diga el navegador.",
        k:[["Altitud","unos 1.486 m"]],
        m:"Puerto de Somiedo" },

      { id:"centro", xy:"43.093,-6.256", n:"Centro de Interpretación", d:1,
        t:"En Pola de Somiedo, junto a la oficina de turismo. Además de la exposición sobre el parque y el oso, es el sitio donde os van a decir lo que ninguna web actualiza a tiempo: qué aparcamientos están saturados hoy, qué pistas están en mal estado y qué orden tiene sentido según los días que llevéis.",
        tip:"Parad aquí el primer día aunque no os apetezca. Ahorra volantazos.",
        m:"Centro Interpretación Parque Natural Somiedo" }
    ]},

    { zona:"La costa occidental", wl:["Cudillero","Luarca","Navia","Valdés"], arte:"costa", nota:"Acantilados altos cortados a pico, playas escondidas al final de un camino y puertos encajados en la roca. Mucho menos masificada que la costa oriental, incluso en agosto.", lugares:[

      { id:"silencio", xy:"43.575,-6.250", n:"Playa del Silencio", d:3,
        t:"El nombre real es Gavieiru, pero se impuso el otro y con razón. Es una cala cerrada por un anfiteatro de acantilados, con un rosario de islotes delante que rompen el oleaje. El suelo es de canto rodado grande, no de arena.¶No es playa de toalla y sombrilla: es playa de mirarla desde arriba y bajar un rato. Se aparca en Castañeras, arriba, y se baja por una senda con escalones de piedra que en la vuelta se nota. Está protegida y no hay ningún servicio.",
        k:[["Suelo","canto rodado"],["Acceso","a pie, con escaleras"],["Servicios","ninguno"]],
        tip:"La luz buena es a última hora de la tarde. Y a esa hora ya se ha ido casi todo el mundo.",
        m:"Playa del Silencio Cudillero" },

      { id:"vidio", xy:"43.593,-6.247", n:"Cabo Vidio", d:3,
        t:"Uno de los cabos más altos de la costa asturiana, con un faro en punta y un acantilado que cae limpio al mar. En día claro se ve un tramo enorme de litoral en las dos direcciones, y con suerte hasta los Picos de Europa al fondo.¶Hay aparcamiento arriba y un paseo corto hasta el mirador. Es de esos sitios donde no hay que hacer nada: llegar, sentarse y esperar a que se ponga el sol.",
        tip:"Combina bien con la Playa del Silencio el mismo atardecer: están a diez minutos.",
        m:"Cabo Vidio Asturias" },

      { id:"cudillero", civ:"https://www.civitatis.com/es/asturias/", xy:"43.562,-6.146", n:"Cudillero", d:4,
        t:"Casas de colores apiladas en un anfiteatro imposible sobre un puerto diminuto. Es de los pueblos más fotografiados de Asturias y en agosto se nota mucho: a mediodía no cabe un alfiler y las terrazas del puerto cobran la vista a precio de vista.¶Los pixuetos, sus habitantes, conservan una habla propia y una fiesta particular, la Amuravela, en la que se lee un pregón satírico sobre el año. El casco viejo se recorre subiendo callejas y escaleras, así que con calzado cómodo.",
        k:[["Aparcar","arriba, nunca abajo"],["Mejor hora","antes de las 11 o al atardecer"]],
        tip:"Unas calles por encima del puerto se come mejor y bastante más barato que en primera línea.",
        m:"Cudillero Asturias" },

      { id:"luarca", civ:"https://www.civitatis.com/es/asturias/", xy:"43.542,-6.535", n:"Luarca", d:4,
        t:"La villa blanca de la costa verde, repartida en siete barrios alrededor de la desembocadura del río Negrillón, con un puerto pesquero todavía activo y puentes que cosen las dos orillas.¶Lo que casi todo el mundo recuerda es el cementerio: está en lo alto del acantilado, junto al faro, con las tumbas de mármol blanco mirando al Cantábrico. Ahí está enterrado Severo Ochoa, que era de aquí. Suena raro recomendarlo, pero es uno de los sitios más bonitos de la costa.",
        k:[["Barrios","siete"],["No perderse","faro y cementerio"]],
        m:"Luarca Asturias" },

      { id:"barayo", xy:"43.548,-6.630", n:"Playa de Barayo", d:4,
        t:"Reserva natural parcial entre los concejos de Navia y Valdés. Tiene un sistema dunar bien conservado, marisma detrás y el río Barayo desembocando en mitad de la arena, lo que forma un paisaje que cambia con la marea.¶Como solo se llega andando —hay una bajada desde el aparcamiento por pista y sendero— nunca está masificada ni en pleno agosto. Es zona protegida, así que ojo con dónde pisáis y con las perras.",
        k:[["Protección","reserva natural parcial"],["Acceso","a pie, unos 20 min"]],
        tip:"Comprobad la normativa de perros antes: al ser espacio protegido puede ser más estricta que en una playa normal.",
        m:"Playa de Barayo Navia", wl:"playa de barayo" },

      { id:"frexulfe", xy:"43.550,-6.680", n:"Playa de Frexulfe",
        t:"Otra playa protegida en el concejo de Navia, con dunas y bosque detrás. Más fácil de acceso que Barayo y también tranquila. Buena alternativa si Barayo os parece mucha caminata.",
        m:"Playa de Frexulfe Navia" },

      { id:"busto", xy:"43.567,-6.440", n:"Cabo Busto", d:4,
        t:"Acantilados y un faro entre Luarca y Cudillero, con molinos de viento en la rasa costera detrás. Es parada corta, de bajarse diez minutos a mirar y seguir, pero el sitio tiene fuerza los días de mar movido.",
        m:"Cabo Busto Asturias" },

      { id:"coana", xy:"43.517,-6.750", n:"Castro de Coaña", d:4,
        t:"Poblado fortificado de la Edad del Hierro, uno de los mejor conservados del noroeste peninsular. Se ven con claridad las plantas circulares de las viviendas encajadas en la ladera, las calles entre ellas y los restos de la muralla y el foso.¶Se excavó por primera vez en el siglo XIX y sigue dando trabajo a los arqueólogos. Tiene centro de recepción y el recorrido es corto y en pendiente suave.",
        k:[["Época","Edad del Hierro"],["Visita","aproximadamente 1 h"]],
        m:"Castro de Coaña" }
    ]},

    { zona:"El interior del oeste", wl:["Grandas de Salime","Villayón","Cangas del Narcea","Ibias"], arte:"embalse", nota:"Valles muy profundos, embalses encajonados y carreteras vacías que cruzan de un concejo a otro por lo alto. La Asturias que no sale en las postales.", lugares:[

      { id:"salime", xy:"43.220,-6.870", n:"Embalse de Salime", d:4,
        t:"Un embalse largo y estrecho metido entre laderas casi verticales, con la carretera colgada por encima durante kilómetros. La subida desde el valle del Navia hasta Grandas es una de las mejores conducciones del viaje.¶La presa es una obra de los años cincuenta, enorme para su tiempo, y tiene algo poco habitual: el arquitecto Joaquín Vaquero Palacios integró arte en la propia central, con relieves y murales dentro de un edificio industrial. Cuando se construyó quedaron varios pueblos bajo el agua.",
        k:[["Presa","años 50"],["Carretera","AS-14, de curvas"]],
        tip:"Hay miradores señalizados en la subida. Merece parar en uno aunque solo sea diez minutos.",
        m:"Embalse de Salime" },

      { id:"museo", xy:"43.216,-6.879", n:"Museo Etnográfico de Grandas", d:5,
        t:"Uno de los mejores museos etnográficos de España, y no es exageración. Lo levantó Pepe el Ferreiro recogiendo durante décadas lo que la gente tiraba: aperos, telares, mobiliario, herramientas de oficios desaparecidos.¶No es una vitrina con cartelitos. Están montados la fragua, el molino, la casa campesina completa, el taller del zapatero, y se entiende cómo funcionaba una economía rural entera. Si tenéis interés por el mundo que retratan las brañas de Somiedo, aquí se cierra el círculo.",
        k:[["Ubicación","Grandas de Salime"],["Visita","1 h 30 o más"]],
        tip:"Comprobad horarios y día de cierre antes de contar con él: es el eje del día 5.",
        m:"Museo Etnográfico Grandas de Salime" },

      { id:"oneta", xy:"43.400,-6.680", n:"Cascadas de Oneta",
        t:"Tres saltos de agua escalonados en un bosque de castaños y robles cerca de Villayón, declarados monumento natural. El primero es el más espectacular y está a menos de veinte minutos del pueblo por camino bien marcado.¶Es la ruta de reserva del viaje: corta, umbría y con agua, perfecta si un día viene con calor de verdad o si las perras han hecho ya demasiado kilómetro.",
        k:[["Distancia","3 km i/v"],["Sombra","toda la ruta"],["Saltos","tres"]],
        m:"Cascadas de Oneta Villayón", wl:"cascadas de oneta" },

      { id:"cangas", xy:"43.176,-6.548", n:"Cangas del Narcea", d:5,
        t:"El concejo más extenso de Asturias y la última parada seria antes de cruzar a León. Tiene vino de la tierra con denominación propia, cosa poco conocida fuera, y el monasterio de Corias, al que llaman el Escorial asturiano por el tamaño.¶Para vosotros es sobre todo el punto logístico: gasolinera, supermercado de verdad y sitio donde comer antes de meterse en el puerto.",
        k:[["Vino","DOP Cangas"],["No perderse","Monasterio de Corias"]],
        tip:"Repostad aquí sí o sí. En el Rañadoiro y Leitariegos no hay nada.",
        m:"Cangas del Narcea" },

      { id:"leitariegos", xy:"42.990,-6.400", n:"Puerto de Leitariegos", d:5,
        t:"El paso de vuelta a León, a unos 1.500 metros, con la estación de esquí a un lado y el valle de Laciana abriéndose al otro. En agosto es una carretera de montaña preciosa y vacía; en invierno es otra historia.",
        k:[["Altitud","unos 1.525 m"]],
        m:"Puerto de Leitariegos" },

      { id:"muniellos", xy:"43.030,-6.680", n:"Bosque de Muniellos",
        t:"El robledal mejor conservado de España y uno de los mayores de Europa, Reserva Natural Integral. La protección es la más estricta que existe: hace falta permiso solicitado con antelación, hay un cupo diario muy reducido de visitantes y no se permite la entrada de animales de compañía.¶Con Bella y Lisboa queda descartado. Lo pongo aquí para que no lo descubráis el día de antes buscando plan.",
        k:[["Permiso","obligatorio y con cupo"],["Perros","no permitidos"]],
        m:"Reserva Natural Integral de Muniellos" }
    ]},

    { zona:"Comer, comprar y repostar", arte:"puerto-mar", nota:"Confirmad horarios y apertura antes de contar con ningún sitio: en la montaña las cocinas cierran pronto y en agosto conviene reservar.", lugares:[

      { id:"comer-somiedo", n:"Comer en Somiedo",
        t:"En Pola de Somiedo hay varias casas de comidas con cocina de montaña: pote asturiano, cabrito, cordero y quesos del propio concejo. Fuera de Pola la oferta cae en picado y en muchos pueblos directamente no hay nada abierto.¶El día de los lagos dad por hecho que coméis lo que llevéis encima: arriba no hay ningún servicio y al bajar es fácil que ya hayan cerrado la cocina.",
        tip:"En los pueblos de montaña la cocina suele cerrar sobre las 15:30. Comer a las tres es tarde.",
        m:"restaurantes Pola de Somiedo" },

      { id:"comer-costa", n:"Comer en la costa",
        t:"Cudillero y Luarca viven del mar: pixín, virrey, besugo, calamar de potera y percebe cuando lo hay. En Cudillero, las terrazas de primera línea del puerto cobran la postal; subiendo un par de calles se come mejor y más barato.¶En Otur, cerca de Luarca, está Casa Consuelo, que lleva décadas siendo la referencia de la zona. En agosto sin reservar es difícil.",
        tip:"En agosto, reservad la víspera en cualquier sitio de la costa que os interese de verdad.",
        m:"Casa Consuelo Otur Luarca" },

      { id:"compra", n:"Compra para la furgo",
        t:"Para llenar nevera de verdad: Cangas del Narcea, Luarca o Navia, que tienen supermercados grandes. En Pola de Somiedo hay tienda, pero pequeña y con horario corto.¶De la zona merecen sitio en la nevera los quesos del occidente y el vino de Cangas. Y agua: en las rutas de altura no hay fuentes fiables.",
        tip:"Comprad para dos días vista. Entre Grandas y Cangas no hay gran cosa.",
        m:"supermercado Navia" },

      { id:"gasolina", n:"Gasolina y agua",
        t:"El occidente de montaña tiene muy pocas gasolineras y algunas cierran a mediodía y los domingos. Los puntos seguros del recorrido son Pola de Somiedo, Navia, Grandas de Salime y Cangas del Narcea.¶Para agua y vaciado, mirad las áreas señaladas en park4night: en los pueblos hay fuentes, pero no siempre con acceso cómodo para llenar depósitos.",
        tip:"Norma de furgo en montaña: por debajo de medio depósito, se reposta en la primera que se vea.",
        m:"gasolinera Cangas del Narcea" }
    ]}
  ],

  info: {
    perras:[
      ["Mastines","En Somiedo hay rebaños con mastines sueltos. Bella y Lisboa atadas y cortas cerca de ganado. Si aparece uno, ni correr ni gritar: seguir andando sin encararlo"],
      ["Garrapatas","Asturias va cargada en verano. Antiparasitario puesto con margen, no la víspera. Revisión al volver de cada ruta"],
      ["Playas","En agosto casi todos los concejos las prohíben. Consultad el bando de cada uno; hay playas caninas señalizadas"],
      ["Agua","En los lagos no hay sombra ni fuentes fiables. Bebedero y agua para ellas en la mochila"],
      ["La furgo","Ni diez minutos al sol con ellas dentro, aunque no parezca que apriete"]
    ],
    furgo:[
      ["Pernocta","Estacionar no es acampar: nada de mesa, sillas, toldo ni patas fuera. Tierra adentro es tranquilo; en la costa en agosto aprietan"],
      ["park4night","Mirad las reseñas del último mes, no las del año pasado: los sitios cambian de un verano a otro"],
      ["Gasolina","En la montaña del occidente hay muy pocas. Repostad en Cangas del Narcea, Grandas o Navia sin apurar"],
      ["Cobertura","Nula en buena parte de Somiedo y del Rañadoiro. Descargad los mapas offline antes de subir"],
      ["Altura","Dormir alto es dormir fresco. En agosto se agradece"]
    ],
    practico:[
      ["Madrugar","Es la única regla del viaje. Farrapona antes de las 9 y la costa antes de las 11"],
      ["Fin de semana","Si podéis, que el día de Saliencia caiga entre semana"],
      ["Carreteras","Puerto de Somiedo, Rañadoiro y Leitariegos son de curvas y lentos. Contad más tiempo del que diga el navegador"],
      ["Emergencias","112"],
      ["Rescate en montaña","112, y decid el nombre exacto de la ruta y el aparcamiento de salida"]
    ]
  }
};
