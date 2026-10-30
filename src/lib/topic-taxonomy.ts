export const TAXONOMY_VERSION = "1";

export const TOPICS = [
  { id: "faith-and-trust", label: "Faith & trust", description: "Trusting Christ, growing in faith, and responding to doubt.", aliases: ["belief", "believing", "doubt"] },
  { id: "prayer", label: "Prayer", description: "Prayer, listening to God, persistence, and a personal relationship with God.", aliases: ["intercession", "praying"] },
  { id: "repentance", label: "Repentance & renewal", description: "Turning back to God, confession, conversion, and a renewed life.", aliases: ["confession", "conversion", "second chances"] },
  { id: "forgiveness", label: "Forgiveness", description: "Receiving God's forgiveness, forgiving others, reconciliation, and forgiving oneself.", aliases: ["reconciliation", "self-forgiveness", "resentment"] },
  { id: "humility", label: "Humility", description: "Humility, pride, sincerity, and honest knowledge of our dependence on God.", aliases: ["pride", "sincerity"] },
  { id: "love-and-mercy", label: "Love & mercy", description: "Compassion, mercy, love of God and neighbor, and welcoming the vulnerable.", aliases: ["compassion", "charity", "loving our neighbor"] },
  { id: "hope-in-suffering", label: "Hope in suffering", description: "Responding to suffering, grief, persecution, hardship, and loss with Christian hope.", aliases: ["grief", "loss", "persecution", "comfort"] },
  { id: "peace-and-anxiety", label: "Peace & anxiety", description: "Finding spiritual peace amid fear, worry, anxiety, chaos, and uncertainty.", aliases: ["fear", "worry", "anxiety", "peace"] },
  { id: "healing-and-restoration", label: "Healing & restoration", description: "Christ's healing, emotional and spiritual wholeness, and restoration of the wounded.", aliases: ["healing", "wholeness", "restoration"] },
  { id: "spiritual-growth", label: "Spiritual growth", description: "Transformation, holiness, spiritual maturity, and becoming more like Christ.", aliases: ["transformation", "holiness", "maturity", "theosis"] },
  { id: "discernment", label: "Spiritual sight & discernment", description: "Recognizing God's presence, spiritual blindness, truth, and discerning God's will.", aliases: ["spiritual blindness", "discernment", "spiritual sight", "truth"] },
  { id: "discipleship", label: "Following Christ", description: "Discipleship, obedience, commitment, and choosing to follow Christ in everyday life.", aliases: ["obedience", "discipleship", "commitment"] },
  { id: "cross-and-sacrifice", label: "The cross & sacrifice", description: "The meaning of Christ's cross, self-giving, bearing the cross, and sacrificial love.", aliases: ["crucifixion", "self-giving", "Holy Cross", "sacrifice"] },
  { id: "resurrection", label: "Resurrection & new life", description: "Christ's resurrection, victory over death, Easter, and the new life it brings.", aliases: ["Easter", "new life", "resurrection"] },
  { id: "incarnation", label: "Christ among us", description: "The incarnation, Nativity, Theophany, and the significance of God becoming human.", aliases: ["Nativity", "Christmas", "Theophany", "incarnation", "Bethlehem"] },
  { id: "christ-revealed", label: "Christ’s glory & divinity", description: "Christ's divine identity and glory, the Transfiguration, and the revelation of who he is through his signs and miracles.", aliases: ["Transfiguration", "Vardavar", "Vartavar", "divinity", "miracles", "glory"] },
  { id: "holy-spirit", label: "The Holy Spirit", description: "The Holy Spirit's presence, gifts, Pentecost, and the Spirit's work in believers.", aliases: ["Pentecost", "gifts of the Spirit"] },
  { id: "eucharist-and-worship", label: "Communion & worship", description: "The Eucharist, Holy Communion, Divine Liturgy, and participation in worship.", aliases: ["Eucharist", "Holy Communion", "Badarak", "Divine Liturgy"] },
  { id: "baptism", label: "Baptism & belonging", description: "Baptism, spiritual rebirth, baptismal identity, and belonging to Christ.", aliases: ["rebirth", "baptismal promises", "born again"] },
  { id: "church-and-community", label: "Church & community", description: "The Church as Christ's body, shared faith, unity, fellowship, and responsibility for one another.", aliases: ["fellowship", "unity", "body of Christ", "community"] },
  { id: "service", label: "Service & witness", description: "Serving others, Christian witness, mission, and putting faith into action.", aliases: ["mission", "witness", "ministry", "service"] },
  { id: "stewardship", label: "Generosity & stewardship", description: "Generosity, stewardship of God's gifts, responsibility, offerings, and the dangers of greed.", aliases: ["generosity", "greed", "possessions", "stewardship", "giving"] },
  { id: "family-and-children", label: "Family & children", description: "Marriage, parenting, family relationships, children, and childlike openness to God.", aliases: ["marriage", "parenting", "childlike faith", "children"] },
  { id: "fasting-and-discipline", label: "Fasting & spiritual discipline", description: "Fasting, Lent, self-control, temptation, and the practices that shape a spiritual life.", aliases: ["Lent", "fasting", "self-control", "temptation"] },
  { id: "gratitude", label: "Gratitude & joy", description: "Thanksgiving, gratitude, Christian joy, contentment, and recognizing God's gifts.", aliases: ["thanksgiving", "contentment", "gratitude", "joy"] },
  { id: "judgment-and-eternity", label: "Judgment & eternal life", description: "Accountability before God, the Second Coming, readiness, salvation, and eternal life.", aliases: ["Second Coming", "accountability", "eternal life", "salvation", "judgment"] },
  { id: "saints-and-tradition", label: "Saints & living tradition", description: "Learning from the saints, Mary, the Church fathers, and the Armenian Church's living tradition.", aliases: ["Mary", "saints", "Church fathers", "Armenian tradition"] }
] as const;

export type TopicId = typeof TOPICS[number]["id"];
