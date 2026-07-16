{
  "bindings": [
    {
      "authLevel": "anonymous",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": [
        "post"
      ],
      "route": "pickup-init"
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ]
}