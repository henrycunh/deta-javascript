export type BasicType = string | number | boolean;

export type NullType = null;

export type UndefinedType = undefined;

export type ObjectType = {
  [key: string]: ObjectType | ArrayType | BasicType | NullType | UndefinedType;
};

export type ArrayType = Array<
  ArrayType | ObjectType | BasicType | NullType | UndefinedType
>;

export type DetaType = ArrayType | ObjectType | BasicType;