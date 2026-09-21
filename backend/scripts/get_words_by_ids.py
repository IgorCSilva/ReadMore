def get_words_by_ids(words, word_ids):
    words_by_id = {
        item["word_id"]: item["word"]
        for item in words
    }

    return [
        words_by_id[word_id]
        for word_id in word_ids
        if word_id in words_by_id
    ]


if __name__ == "__main__":
    words = [
  {
    "word_id": "es-wd-0001",
    "root_word_id": "wd-0001",
    "word": "hola",
    "gender_id": "not_apply"
  },
  {
    "word_id": "es-wd-0002",
    "root_word_id": "wd-0002",
    "word": "hola",
    "gender_id": "not_apply"
  },
  {
    "word_id": "es-wd-0003",
    "root_word_id": "wd-0003",
    "word": "adiós",
    "gender_id": "not_apply"
  },
  {
    "word_id": "es-wd-0004",
    "root_word_id": "wd-0004",
    "word": "por favor",
    "gender_id": "not_apply"
  },
  {
    "word_id": "es-wd-0005",
    "root_word_id": "wd-0005",
    "word": "gracias",
    "gender_id": "not_apply"
  },
  {
    "word_id": "es-wd-0006",
    "root_word_id": "wd-0006",
    "word": "qué",
    "gender_id": "not_apply"
  },
  {
    "word_id": "es-wd-0007",
    "root_word_id": "wd-0013",
    "word": "tú",
    "gender_id": "not_apply"
  },
  {
    "word_id": "es-wd-0008",
    "root_word_id": "wd-0014",
    "word": "mucho gusto",
    "gender_id": "not_apply"
  },
  {
    "word_id": "es-wd-0009",
    "root_word_id": "wd-0022",
    "word": "adiós",
    "gender_id": "not_apply"
  },
  {
    "word_id": "es-wd-0010",
    "root_word_id": "wd-0051",
    "word": "cómo",
    "gender_id": "not_apply"
  },
  {
    "word_id": "es-wd-0011",
    "root_word_id": "wd-0063",
    "word": "y",
    "gender_id": "not_apply"
  },
  {
    "word_id": "es-wd-0012",
    "root_word_id": "wd-0260",
    "word": "me",
    "gender_id": "not_apply"
  },
  {
    "word_id": "es-wd-0013",
    "root_word_id": "wd-0261",
    "word": "llamo",
    "gender_id": "not_apply"
  },
  {
    "word_id": "es-wd-0014",
    "root_word_id": "wd-0262",
    "word": "te",
    "gender_id": "not_apply"
  },
  {
    "word_id": "es-wd-0015",
    "root_word_id": "wd-0263",
    "word": "llamas",
    "gender_id": "not_apply"
  },
  {
    "word_id": "es-wd-0016",
    "root_word_id": "wd-0264",
    "word": "se",
    "gender_id": "not_apply"
  },
  {
    "word_id": "es-wd-0017",
    "root_word_id": "wd-0265",
    "word": "llama",
    "gender_id": "not_apply"
  },
  {
    "word_id": "es-wd-0018",
    "root_word_id": "wd-0084",
    "word": "familia",
    "gender_id": "feminine"
  },
  {
    "word_id": "es-wd-0019",
    "root_word_id": "wd-0011",
    "word": "mi",
    "gender_id": "not_apply"
  },
  {
    "word_id": "es-wd-0020",
    "root_word_id": "wd-0010",
    "word": "es",
    "gender_id": "not_apply"
  },
  {
    "word_id": "es-wd-0021",
    "root_word_id": "wd-0085",
    "word": "madre",
    "gender_id": "feminine"
  },
  {
    "word_id": "es-wd-0022",
    "root_word_id": "wd-0086",
    "word": "padre",
    "gender_id": "masculine"
  },
  {
    "word_id": "es-wd-0023",
    "root_word_id": "wd-0089",
    "word": "hermano",
    "gender_id": "masculine"
  },
  {
    "word_id": "es-wd-0024",
    "root_word_id": "wd-0088",
    "word": "hermana",
    "gender_id": "feminine"
  },
  {
    "word_id": "es-wd-0025",
    "root_word_id": "wd-0093",
    "word": "hijo",
    "gender_id": "masculine"
  },
  {
    "word_id": "es-wd-0026",
    "root_word_id": "wd-0094",
    "word": "hija",
    "gender_id": "feminine"
  },
  {
    "word_id": "es-wd-0027",
    "root_word_id": "wd-0091",
    "word": "abuelo",
    "gender_id": "masculine"
  },
  {
    "word_id": "es-wd-0028",
    "root_word_id": "wd-0090",
    "word": "abuela",
    "gender_id": "feminine"
  },
  {
    "word_id": "es-wd-0029",
    "root_word_id": "wd-0100",
    "word": "tío",
    "gender_id": "masculine"
  },
  {
    "word_id": "es-wd-0030",
    "root_word_id": "wd-0099",
    "word": "tía",
    "gender_id": "feminine"
  },
  {
    "word_id": "es-wd-0031",
    "root_word_id": "wd-0266",
    "word": "primo",
    "gender_id": "masculine"
  },
  {
    "word_id": "es-wd-0032",
    "root_word_id": "wd-0016",
    "word": "él",
    "gender_id": "masculine"
  },
  {
    "word_id": "es-wd-0033",
    "root_word_id": "wd-0017",
    "word": "ella",
    "gender_id": "feminine"
  },
  {
    "word_id": "es-wd-0034",
    "root_word_id": "wd-0267",
    "word": "su",
    "gender_id": "not_apply"
  },
  {
    "word_id": "es-wd-0035",
    "root_word_id": "wd-0268",
    "word": "tengo",
    "gender_id": "not_apply"
  },
  {
    "word_id": "es-wd-0036",
    "root_word_id": "wd-0269",
    "word": "tienes",
    "gender_id": "not_apply"
  },
  {
    "word_id": "es-wd-0037",
    "root_word_id": "wd-0012",
    "word": "tu",
    "gender_id": "not_apply"
  }
]


    word_ids = [
            "es-wd-0001",
            "es-wd-0003",
            "es-wd-0004",
            "es-wd-0005",
            "es-wd-0012",
            "es-wd-0013",
            "es-wd-0010",
            "es-wd-0014",
            "es-wd-0015",
            "es-wd-0016",
            "es-wd-0017",
            "es-wd-0008",
            "es-wd-0011",
            "es-wd-0007",
            "es-wd-0006"
          ]

    result = get_words_by_ids(
        words=words,
        word_ids=word_ids
    )

    print(result)