# Relationships

Logical relationships (Mongo does not enforce FKs):

```mermaid
erDiagram
  User ||--o{ Order : creates
  Party ||--o{ Order : customer
  Product ||--o{ OrderItem : line
  Order ||--o{ OrderApproval : has
  Order ||--o{ OrderDispatch : has
  OrderDispatch ||--o{ TransportShipment : ships
  Order ||--o{ OrderDelivery : delivers
  Order ||--o{ OrderFlag : flagged
  Lead ||--o{ LeadFollowUp : follows
  Lead ||--o{ LeadQuotation : quotes
  WorkPlan ||--o{ WorkPlanVisit : visits
  WorkPlan ||--o{ WorkPlanExpense : expenses
  User ||--o| UserWorkPlannerSettings : settings
  User ||--o{ Notification : receives
```

## Notable refs
- Order → party, customer, lead, created_by
- OrderApproval → order
- PartyProductRate → party, product, mapping
- Attachment → entity_type + entity_id (polymorphic)
- TransportShipment → transporter ref **without registered Transporter model** (debt)

## Related
- [ERD](09-erd.md)
