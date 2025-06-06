# Graph-Diagram

A mermaid-like playground converting plain text to graph diagrams with nodes and edges. The syntax is very similar to the [Mermaid](https://mermaid.js.org/syntax/sequenceDiagram) or [PlantUML](https://plantuml-documentation.readthedocs.io/en/latest/diagrams/sequence.html) sequence diagrams.

## Syntax

Below is a simple example of a graph.

```md
graphDiagram The three amigos
    person Alice 25 #lightgreen
    person Bob 12 #lightblue
    person Charlie 8 #orange
    book One_flew_over_the_cuckoo_nest 16 #purple 
    
    Alice->Bob: Hello Bob!
    Bob->Alice: Hi Alice!
    Alice-5->Charlie: How are you?
    Charlie--Bob: Good, thanks!
    Charlie--One_flew_over_the_cuckoo_nest: Has read
```
![The three amigos](https://github.com/user-attachments/assets/cce0ccb0-8257-4dc0-93df-7c468f802e20)

It all starts with a `graphDiagram`, followed by an optional title (only used for exporting the graph to a PNG image).

Next comes an optional list of nodes:

  - type: node (renders as a circle), person, group, book, company, concept, education, location, tag, message or document
  - label: Name of the node, optionally using underscores for spaces
  - size: size of the node
  - color: hex color like #f00 or #red

Finally, it is followed by a list of edges:

  - From label
  - Edge type: `--` is a line, `->` is an arrow, optionally including the size (weight) of the edge, i.e. `-12-` or `-5->`.
  - Colon
  - Edge label
