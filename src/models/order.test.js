const Order = require("./order");
const OrderItem = require("./order-item");
const OrderItemLotAllocation = require("./order-item-lot-allocation");
const OrderHistory = require("./order-history");
const Customer = require("./customer");
const User = require("./user");
const Currency = require("./currency");
const Product = require("./product");
const ItemState = require("./item-state");
const Lot = require("./lot");

describe("Order models", () => {
  it("defines the documented order columns and table name", () => {
    const attributes = Order.getAttributes();

    expect(Order.tableName).toBe("orders");
    expect(attributes.number.allowNull).toBe(false);
    expect(attributes.customer_id.allowNull).toBe(false);
    expect(attributes.user_id.allowNull).toBe(false);
    expect(attributes.currency_id.allowNull).toBe(false);
    expect(attributes.status.defaultValue).toBe("draft");
    expect(attributes.subtotal.type.toString()).toBe("DECIMAL(12,2)");
    expect(attributes.total.type.toString()).toBe("DECIMAL(12,2)");
    expect(attributes.delivery_address.type.toString()).toBe("VARCHAR(500)");
    expect(attributes.notes.type.key).toBe("TEXT");
  });

  it("declares the order header associations", () => {
    const expected = [
      ["customer", Customer, "customer_id"],
      ["user", User, "user_id"],
      ["currency", Currency, "currency_id"],
    ];

    for (const [alias, target, foreignKey] of expected) {
      expect(Order.associations[alias].associationType).toBe("BelongsTo");
      expect(Order.associations[alias].target).toBe(target);
      expect(Order.associations[alias].options.foreignKey).toBe(foreignKey);
    }

    expect(Customer.associations.orders.target).toBe(Order);
    expect(User.associations.orders.target).toBe(Order);
    expect(Currency.associations.orders.target).toBe(Order);
  });

  it("defines order items and their relations", () => {
    const attributes = OrderItem.getAttributes();

    expect(OrderItem.tableName).toBe("order_items");
    expect(attributes.quantity.allowNull).toBe(false);
    expect(attributes.unit_price.type.toString()).toBe("DECIMAL(12,2)");
    expect(attributes.subtotal.type.toString()).toBe("DECIMAL(12,2)");
    expect(Order.associations.items.target).toBe(OrderItem);
    expect(OrderItem.associations.order.target).toBe(Order);
    expect(OrderItem.associations.product.target).toBe(Product);
    expect(OrderItem.associations.item_state.target).toBe(ItemState);
    expect(Product.associations.order_items.target).toBe(OrderItem);
    expect(ItemState.associations.order_items.target).toBe(OrderItem);
  });

  it("defines the lot allocations with their status default", () => {
    const attributes = OrderItemLotAllocation.getAttributes();

    expect(OrderItemLotAllocation.tableName).toBe("order_item_lot_allocations");
    expect(attributes.quantity.allowNull).toBe(false);
    expect(attributes.status.defaultValue).toBe("reserved");
    expect(OrderItem.associations.allocations.target).toBe(
      OrderItemLotAllocation,
    );
    expect(OrderItemLotAllocation.associations.lot.target).toBe(Lot);
    expect(Lot.associations.order_item_lot_allocations.target).toBe(
      OrderItemLotAllocation,
    );
  });

  it("defines the append-only history events", () => {
    const attributes = OrderHistory.getAttributes();

    expect(OrderHistory.tableName).toBe("order_history");
    expect(attributes.event_type.allowNull).toBe(false);
    expect(attributes.from_status.allowNull).toBe(true);
    expect(attributes.to_status.allowNull).toBe(true);
    expect(attributes.actor_user_id.allowNull).toBe(true);
    expect(attributes.metadata.type.key).toBe("JSONB");
    expect(Order.associations.history.target).toBe(OrderHistory);
    expect(OrderHistory.associations.order.target).toBe(Order);
    expect(OrderHistory.associations.actor_user.target).toBe(User);
  });
});
